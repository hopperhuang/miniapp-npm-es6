const { src, dest,  parallel, series } = require('gulp')
const less = require('gulp-less');
const clean = require('gulp-clean')
const through2 = require('through2')
const path = require('path')
const parser = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default;
const t = require('@babel/types')
const babel = require('gulp-babel');
const fs = require('fs')
const webpack = require('webpack')
const webpackConfig = require('./webpack.config')
const rename = require("gulp-rename");


function style() {
    return src('src/**/*.less')
        .pipe(less())
        .pipe(rename((path)=> {
            path.extname = '.wxss'
        }))
        .pipe(dest('dist/'))
}
function html() {
    return src('src/**/*.html')
        .pipe(rename((path) => {
            path.extname = '.wxml'
        }))
        .pipe(dest('dist/'))
}
function isRelativePath(path) {
    const reg = /^(?:\/|\.)(?:.*)$/
    return reg.test(path)
}

function MiniAppJson() {
    return src('src/*.json')
        .pipe(dest('dist/'))
}

function MiniAppWxss() {
    return src('src/app.wxss')
        .pipe(dest('dist/'))
}

// collect npm packages
const npm = {}
function compilejs() {
    const npmPath = path.resolve(__dirname, './src/npm/index')
    return src(['src/**/*.js', '!src/npm/*.js'])
        .pipe(through2.obj(function(file, _, cb) {
            const { dirname, contents: buffer } = file
            // console.log(filePath)
            const relativePath = path.relative(dirname, npmPath)
            const content = buffer.toString()
            const ast = parser.parse(content)
            traverse(ast, {
                CallExpression(path) {
                    if (t.isIdentifier(path.node.callee, { name: 'require' })) {
                        if (t.isStringLiteral(path.node.arguments[0])) {
                            const requirePath = path.node.arguments[0].value
                            const isRelative = isRelativePath(requirePath)
                            if (!isRelative) { // is package
                                // collect dependencies
                                if (!npm[requirePath]) {
                                    npm[requirePath] = true
                                }
                                // replace string
                                path.replaceWith(
                                    t.memberExpression(
                                        t.callExpression(
                                            t.identifier('require'),
                                            [t.stringLiteral(relativePath)]
                                        ),
                                        t.stringLiteral(requirePath),
                                        true,
                                    )
                                )
                            }
                        }
                    }
                }
            })
            const { code  } = generate(ast)
            const bufferContent = new Buffer(code)
            file.contents = bufferContent
            cb(null, file);
        }))
        .pipe(babel({
            presets: [['@babel/env', { 
                useBuiltIns: false,
            }]],
        }))
        .pipe(dest('dist/'))
}


function cleanStyle() {
    return src('dist/**/*.wxss')
        .pipe(clean({ force: true }))
}
function cleanWxml() {
    return src('dist/**/*.wxml')
        .pipe(clean({ force: true }))
}
function cleanScript() {
    return src('dist/**/*.js')
        .pipe(clean({ force: true }))
}
function cleanNpm() {
    return src([ 'src/npm/*.js', 'src/npm/*.json'])
        .pipe(clean({ force: true }))
}

function cleanJson() {
    return src('dist/*.json')
        .pipe(clean({ force: true }))
}

function buildNpmScript(cb) {
    let importScript = ''
    let exportObjectScript = 'const npm = {};\n'
    const dependencies = Object.keys(npm)
    for (let index = 0; index < dependencies.length; index++) {
        const dependency = dependencies[index];
        // const iScript = `import _m${index} from '${dependency}';\n`
        const iScript = `const _m${index} = require('${dependency}');\n`
        importScript += iScript
        const eScript = `npm['${dependency}'] = _m${index};\n`
        exportObjectScript += eScript
    }
    const exportScript = 'module.exports = npm;'
    const npmFileScript = importScript + exportObjectScript + exportScript
    const npmFIlePath = path.resolve(__dirname, './src/npm/index.js')
    fs.writeFile(npmFIlePath, npmFileScript, (err) => {
        if (err) {
            cb(err)
        }  else {
            cb()
        }
    })
}

function buildNpmJson(cb) {
    const npmJson = JSON.stringify(npm)
    const npmJsonPath = path.resolve(__dirname, './src/npm/npm.json')
    fs.writeFile(npmJsonPath, npmJson, (err) => {
        if (err) {
            cb(err)
        }   else {
            cb()
        }
    })
}
function buildNpmPackage(cb) {
    webpack(webpackConfig, (err, stats) => {
        if (err) {
            cb(err)
            return;
        }

        console.log(stats.toString({
            chunks: false,  
            colors: true,
        }));
        cb()
    })
}



exports.default = series(
    parallel(cleanStyle, cleanWxml, cleanScript, cleanNpm, cleanJson),
    parallel(style, html, compilejs, MiniAppJson, MiniAppWxss),
    parallel(buildNpmScript, buildNpmJson),
    buildNpmPackage,
)
exports.style = style
exports.html = html
exports.compilejs = compilejs

exports.clear = parallel(cleanStyle, cleanWxml, cleanScript, cleanNpm)
exports.cleanStyle = cleanStyle
exports.cleanWxml = cleanWxml
exports.cleanScript = cleanScript

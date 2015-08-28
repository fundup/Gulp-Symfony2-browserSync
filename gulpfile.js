'use strict';

var gulp = require('gulp');
var plugins = require('gulp-load-plugins')();
var notifier = require('node-notifier');
var bytediff = require('gulp-bytediff');
var taskListing = require('gulp-task-listing');
var runSequence = require('run-sequence');

var browserSync = require('browser-sync').create();

var log = plugins.util.log;

//CONFIG : PATHS
var config = require('./gulp.json');
// Gulp Config
var showErrorNotifications = true,
    allowChmod = true;

/* Errorhandling
 ========================================================================== */
var errorLogger, headerLines;

errorLogger = function(headerMessage,errorMessage){
    var header = headerLines(headerMessage);
    header += '\n             '+ headerMessage +'\n           ';
    header += headerLines(headerMessage);
    header += '\r\n \r\n';
    plugins.util.log(plugins.util.colors.red(header) + '             ' + errorMessage + '\r\n')

    if(showErrorNotifications){
        notifier.notify({
            'title': headerMessage,
            'message': errorMessage,
            'contentImage':  __dirname + "/gulp_error.png"
        });
    }
}

headerLines = function(message){
    var lines = '';
    for(var i = 0; i< (message.length + 4); i++){
        lines += '-';
    }
    return lines;
}

/* List the available gulp tasks
 ========================================================================== */
gulp.task('tasks', plugins.taskListing);

/* Styles
 ========================================================================== */
gulp.task('styles', function() {
    log('Bundling, minifying all css');

    return gulp.src(config.app.stylesheets.paths)
        // Sass
        .pipe(plugins.rubySass({
            loadPath: './',
            bundleExec: true
        }))
        .on('error', function (err) {
            errorLogger('SASS Compilation Error', err.message);
        })

        //concat if vendor
        //.pipe(plugins.concat({path: 'all.min.css', cwd: ''}))

        // Combine Media Queries
        .pipe(plugins.combineMq())

        // Prefix where needed
        //.pipe(plugins.autoprefixer(config.browserSupport))

        // Minify output
        .pipe(plugins.minifyCss())

        // Rename the file to respect naming covention.
        .pipe(plugins.rename(function(path){
            path.basename += '.min';
            //add versionning
            //path += '?v='+config.app.version;
        }))

        // Write to output
        .pipe(gulp.dest(config.app.stylesheets.dist))

        //inject css in browser
        .pipe(browserSync.stream())

        // Show total size of css
        .pipe(plugins.size({
            title: 'css'
        }));
});


/* Images
 ========================================================================== */
gulp.task('images', function() {
    return gulp.src(config.app.img.src)
        // Only optimize changed images
        //.pipe(plugins.changed(config.dist.img))

        //// Imagemin
        //.pipe(plugins.imagemin({
        //    optimizationLevel: 3,
        //    progressive: true,
        //    svgoPlugins: [{
        //        removeViewBox: false
        //    }]
        //}))

        // Set destination
        .pipe(gulp.dest(config.app.img.dist))

        // Show total size of images
        .pipe(plugins.size({
            title: 'images'
        }));
});

/* Javascripts
 ========================================================================== */
/* Add Async tag to script
 ========================================================================== */
var addAsyncTag = function (filepath, file, i, length) {

    if(config.app.javascripts.async === 'true') {
        return '<script src="'+ filepath + '" async></script>';
    } else {
        return '<script src="'+ filepath +'"></script>';
    }
}

//compile
gulp.task('compile:javascript', function() {
    log('Bundling, minifying all JavaScript defined in gulp.json');

    return gulp.src(config.app.javascripts.paths)

        .on('error', function (err){
            errorLogger('Javascript Error', err.message);
        })

        .pipe(plugins.concat('app.min.js'))
        .pipe(plugins.bytediff.start())
        .pipe(plugins.uglify())
        .pipe(plugins.bytediff.stop())

        // versionning
        //.pipe(plugins.rev())

        .pipe(gulp.dest(config.app.javascripts.dist))

        // Show total size of js
        .pipe(plugins.size({
            title: 'js'
        }));
});

gulp.task('inject-scripts', ['compile:javascript'], function() {
    log('JavaScript injection in footer');

    return gulp.src(config.app.javascripts.inject.base + config.app.javascripts.inject.folder + config.app.javascripts.inject.fileName)
        // Inject files
        .pipe(plugins.inject(gulp.src(config.app.javascripts.dist + '/**/*.js'), {
            transform: addAsyncTag,
            ignorePath: '/web'
        }))

        // Chmod for local use
        .pipe(plugins.if(allowChmod, plugins.chmod(777)))

        // Write
        .pipe(gulp.dest(config.app.javascripts.inject.base + config.app.javascripts.inject.folder));
});

/* Fonts
 ========================================================================== */
gulp.task('fonts', function() {
    return gulp.src(config.fonts.paths)
        // Set destination
        .pipe(gulp.dest(config.fonts.dist));
});

/* Browser Sync
 ========================================================================== */

gulp.task('serve:dev', ['styles','inject-scripts'], function() {

    browserSync.init({
        proxy: "run.dev"
    });

    //on sass change => stream in browser
    gulp.watch(config.app.stylesheets.bundleLocation, ['styles']);
    //on javascript change
    gulp.watch(config.app.javascripts.bundleLocation, ['inject-scripts', 'browserSync:reload']);
    //gulp.watch("*.html").on("change", browserSync.reload);
});


/* BUILD
 ========================================================================== */

// create a task that ensures the `js` task is complete before
// reloading browsers
gulp.task('build', ['styles'], function(done) {
    runSequence(
        ['cc', 'compile:javascript', 'inject-scripts'],
    done);
});

/* Other tasks
 ========================================================================== */

// BrowserSync reload all Browsers
gulp.task('browserSync:reload', function() {
    browserSync.reload();
});

// Clear symfony cache
gulp.task('cc', plugins.shell.task([
    'rm -rf app/cache/*',
    'sh permission-cache.sh'
]));

// OVerride validation for vendor (no other way)
gulp.task('override', plugins.shell.task([
    'sudo cp app/Resources/FOSCommentBundle/config/validation.xml vendor/friendsofsymfony/comment-bundle/FOS/CommentBundle/Resources/config/',
]));




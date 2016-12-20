var gulp = require ('gulp');
var sass = require ('gulp-sass');
var concat = require ('gulp-concat');

//gulp.task('cssConcat', function() {
//	gulp.src('./css/**/*.css')
//		.pipe(concat('all.css'))
	//	.pipe(gulp.dest('./dist'));
//});

gulp.task('sass', function() {
	gulp.src('./project/**/*.scss')
		.pipe(sass())//.on('error', sass.logError))
		.pipe(gulp.dest('./project'));
});

gulp.task('sass:watch', function() {
	gulp.watch('./project/**/*.scss', ['sass']);
});


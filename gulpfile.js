var gulp = require('gulp');
var sass = require('gulp-sass')(require('sass'));

gulp.task('sass', function(cb) {
  return gulp.src('styles/*.scss')
  .pipe(sass())
  .pipe(gulp.dest('assets'));

});

gulp.task('watch', function(cb) {
  gulp.watch('styles/**/*.scss', gulp.series('sass'));
  
})


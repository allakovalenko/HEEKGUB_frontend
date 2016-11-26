$(document).ready(function() {
  $('#portfolio-section').show();
  $('#project-title').hide();

  $('#portfolio-section').click(function(event) {
    event.preventDefault();
    $('#project-title').slideToggle();
  });
});

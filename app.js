// Jimoo - The Techhub Feedback Tool

// setup express 
var express = require('express')
var app = express()

var port = process.env.PORT || 3000

// configure assets and views
app.use('/assets', express.static(__dirname + '/public'))
app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')

// load the controller
var feedbackController = require('./controllers/feedbackController')

feedbackController(app)

// Start server.
console.log('Jimoo server listening on port', port);

app.listen(port)

// done -eol
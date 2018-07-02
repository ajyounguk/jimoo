// Jimoo - Easy Feedback Tool

// load modules
var mongoose = require('mongoose')
var express = require('express')
var fs = require('fs')
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');

// express setup
var app = express()
var port = process.env.PORT || 3000


// configure assets, views, json encoded bodies and encoded bodies
app.use('/assets', express.static(__dirname + '/public'))
app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(bodyParser.json()); 
app.use(bodyParser.urlencoded({
    extended: true
})); 

// load & set mongo config
var mongoConfig = JSON.parse(fs.readFileSync(__dirname + '/config/mongo-config.json', 'utf8'));
var mongourl = mongoConfig.mongourl

// connect to mongo
mongoose.connect(mongourl, function (err) {
    if (err) {
        console.log('MongoDB connection error')
        console.log( JSON.stringify(err),null,3)
        throw err
    } else {
        console.log("Jimoo connected to MongoDB")
    }
})



// load the controllers
var feedbackAdminController = require('./controllers/feedbackAdminController')
var feedbackController = require('./controllers/feedbackController')
var setupController = require('./controllers/setupController')


feedbackAdminController(app)
feedbackController(app)
setupController(app, mongoose)


// Start server.
console.log('Jimoo web server listening on port', port);

app.listen(port)

// done -eol
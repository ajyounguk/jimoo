// Jimoo - feedback controler
module.exports = function (app, mongoose) {


    var ui = {}

    // load Event model for mongo
    var Event = require('../models/eventModel')
    

    // setup bodyparser
    var bodyParser = require('body-parser');
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({
        extended: true
    })); // support encoded bodies



    // serve up main test page 
    app.get('/', function (req, res) {

        var dateNow = new Date(Date.now()).toISOString().split('T')[0]
        var timeNow = new Date(Date.now()).toTimeString().split(' ')[0].substr(0,5)        

        ui = {
            menuitem: 1,
            data: [],
            def_: '',
            def_todayd: dateNow,
            def_todayt: timeNow
        }

        ui.menuitem = 1

        res.setHeader('Content-Type', 'text/html');
        res.render('./index', {
            ui: ui
        })

    })

    // 1. create event
    app.post('/event', function (req, res) {

        ui.menuitem = 1
        var date = new Date(Date.now())
        ui.data[ui.menuitem] = {
            "timestamp": date,
            "status": '',
            sdkResponse: ''
        }


        res.render('./index', {
            ui: ui
        })
    })






}
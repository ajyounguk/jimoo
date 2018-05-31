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
    app.post('/admin/event', function (req, res) {


        var date = new Date(Date.now())
        var startd = new Date(req.body.startdate + " " + req.body.starttime)
        var endd = new Date(req.body.enddate + "    " + req.body.endtime)
        

        ui.menuitem = 1
        ui.data[ui.menuitem] = {
            timestamp: date,
            status: '',
            response: '',
            pin: ''
        }

        // setup data in the model
        var event = Event ({
            event : {
                name : req.body.eventname,
                location: req.body.location,
                presenter: req.body.presenter,
                notes: req.body.notes,
                start: startd,
                end: endd
            }
        })

  
        event.save(function (err) {
            if (err) {
                res.status = 500
                ui.data[ui.menuitem].status = '500'
                ui.data[ui.menuitem].response = err
                ui.data[ui.menuitem].pin = 'Error Creating Event!'
            } else {
                res.status = 201
                ui.data[ui.menuitem].status = '201'
                ui.data[ui.menuitem].response = event
                ui.data[ui.menuitem].pin = 'SUCC'
            }

            res.render('./index.ejs', {
                ui: ui
            })
        })
    })






}
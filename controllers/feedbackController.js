// Jimoo - feedback controler
// web ui and mongo controller for the admin interactions 
//

module.exports = function (app, mongoose) {

    // init vars
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
        var timeNow = new Date(Date.now()).toTimeString().split(' ')[0].substr(0, 5)

        var thisYear = new Date(Date.now()).getFullYear()
        var thisMonth = new Date(Date.now()).getMonth() 

        var listStartDate = new Date(thisYear, thisMonth, 2 ).toISOString().split('T')[0]
        var listEndDate = new Date(thisYear, thisMonth +1 , 2).toISOString().split('T')[0]

        ui = {
            menuitem: 1,
            data: [],
            def_today_date: dateNow,
            def_today_time: timeNow,
            def_list_start: listStartDate,
            def_list_end: listEndDate
        }

        ui.menuitem = 1

        res.setHeader('Content-Type', 'text/html');
        res.render('./index', {
            ui: ui
        })

    })


    // 1. create event
    app.post('/admin/event', function (req, res) { 


        // PIN maker helper function
        // generates random 5 char code + checks if collision exists in mongo
        function makePin (attempts, callback) {

            if (attempts >= 20) {
                callback('too may attempts at pin generation', null)
            }

            console.log('try', attempts)

            var text = ""
            var possible = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789";
            
            for (var i = 0; i < 5; i++) {
                text += possible.charAt(Math.floor(Math.random() * possible.length))
            }

            // check PIN doesn't already exist
            Event.find({ 'event.pin': text }, function(err, result) {

                if (err) {
                    callback (err, null) // error
                } else {
                    if (result.length) {
                        attempts++
                        makePin(attempts, callback)
                    } else {
                        callback (null, text) // no pin collision all good
                    }
                }
            })
        }

        // set timestamp 
        var date = new Date(Date.now())

        // get & format dates from form
        var startd = new Date(req.body.startdate + " " + req.body.starttime)
        var endd = new Date(req.body.enddate + "    " + req.body.endtime)

        // init UI
        ui.menuitem = 1
        ui.data[ui.menuitem] = {
            timestamp: date,
            status: '',
            response: '',
            pin: ''
        }
            
        
        var pin = null
        
        makePin (0, function (err, pincode) {
            if (err) {
                res.status = 500
                ui.data[ui.menuitem].status = '500'
                ui.data[ui.menuitem].response = err
            } else {
            
                // setup data in the model
                var event = Event({
                    event: {
                        name: req.body.name,
                        location: req.body.location,
                        presenter: req.body.presenter,
                        email: req.body.email,
                        notes: req.body.notes,
                        start: startd,
                        end: endd,
                        pin: pincode
                    }
                })

                event.save(function (err) {
                    if (err) {
                        res.status = 500
                        ui.data[ui.menuitem].status = '500'
                        ui.data[ui.menuitem].response = err
                    } else {
                        res.status = 201
                        ui.data[ui.menuitem].status = '201'
                        ui.data[ui.menuitem].response = event
                    }

                    res.render('./index.ejs', {
                        ui: ui
                    })
                })

              

            }
        })
    })


    // 2. list
    app.post('/admin/events', function (req, res) {

        var date = new Date(Date.now())

        var startdate = new Date(req.body.lstartdate +' 00:00:00')
        var enddate = new Date(req.body.lenddate +' 24:00:00')


        ui.menuitem = 2
        ui.data[ui.menuitem] = {
            timestamp: date,
            status: '',
            response: ''
        }

        Event.find({
            'event.start': {
                $gte: startdate,
                $lte: enddate
            }   }, function (err, events) {


            if (err) {
                ui.data[ui.menuitem].status = '500'
                ui.data[ui.menuitem].response = err
            } else {
                ui.data[ui.menuitem].status = '200'
                ui.data[ui.menuitem].response = events
            }

            res.render('./index.ejs', {
                ui: ui
            })
        })

    })


    // 3. modify existing
    app.get('/admin/events:id', function (req, res) {

        var date = new Date(Date.now())

        var mongoid = req.params.id;


        ui.menuitem = 3
        ui.data[ui.menuitem] = {
            timestamp: date,
            status: '',
            response: ''
        }

            res.render('./index.ejs', {
                ui: ui
            })

    })


}
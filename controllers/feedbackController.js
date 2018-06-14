// Jimoo - feedback controler
// web ui and mongo controller for the admin interactions 
//

module.exports = function (app, mongoose) {

    // init vars
    
    // create prepop dates = todays date and time
    var dateNow = new Date(Date.now()).toISOString().split('T')[0]
    var timeNow = new Date(Date.now()).toTimeString().split(' ')[0].substr(0, 5)

    // list prepop dates = todays date & todays date + 1 month
    var thisYear = new Date(Date.now()).getFullYear()
    var thisMonth = new Date(Date.now()).getMonth() 
    var listStartDate = new Date(thisYear, thisMonth, 2 ).toISOString().split('T')[0]
    var listEndDate = new Date(thisYear, thisMonth +1 , 2).toISOString().split('T')[0]


    // ui = data object holds all data required by the UI
    //
    // set debug for json ouput of the data
    //
    // flow.activateDiv = div to be enabled when form loads
    // flow.activateButton = button to be enabled when form loads

    // set timestamp 
    var date = new Date(Date.now())

    var ui = {
        debug: true,
        timestamp: date,
        flow: {
            activateDiv: 'create-div',
            activateButton: 'create-button',
        },
        data: {
            create: {
                response: {
                    event: {
                        name: '',
                        location: '',
                        presenter: '',
                        start: null,
                        end: null,
                        email: '',
                        notes: '',
                        pin: ''
                    },
                },
                prepop: {
                    todayDate: dateNow,
                    todayTime: timeNow
                },
            },
            list: {
                response: {},
                prepop: {
                    startDate: listStartDate,
                    endDate: listEndDate
                }
            }
        }
    }


    // load Event model for mongo
    var Event = require('../models/eventModel')

    // setup bodyparser
    var bodyParser = require('body-parser');
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({
        extended: true
    })); // support encoded bodies





    // serve up admin form
    app.get('/', function (req, res) {

        res.setHeader('Content-Type', 'text/html');
        res.render('./index', {
            ui: ui
        })
    })






    // 1a. create event + display confirm screen
    app.post('/admin/event/create', function (req, res) { 


        //var startd = new Date(req.body.startdate + " " + req.body.starttime)
        //var endd = new Date(req.body.enddate + " " + req.body.endtime)

        // init UI        
        ui.flow.activateDiv = 'create-confirmation-div'
        ui.flow.activateButton = 'create-button'        

        ui.data.create.response.event.name = req.body.name
        ui.data.create.response.event.location = req.body.location
        ui.data.create.response.event.presenter = req.body.presenter
        ui.data.create.response.event.email = req.body.email
        ui.data.create.response.event.notes = req.body.notes
        ui.data.create.response.event.startdate = req.body.startdate
        ui.data.create.response.event.starttime = req.body.starttime
        ui.data.create.response.event.enddate = req.body.enddate
        ui.data.create.response.event.endtime = req.body.endtime


        

        // redirect to confirmation screen
        res.render('./index.ejs', {
            ui: ui
        })
    
    })

    

    // 1c. save event
    app.post('/admin/event/save', function (req, res) { 

        
        // PIN maker helper function
        // generates random 5 char code + checks if collision exists in mongo
        function makePin (attempts, callback) {

            if (attempts >= 20) {
                console.log('ERROR, pin generation failed after too many collisions (20)')
                callback('too may attempts at pin generation', null)
            }

            var text = ""
            var possible = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
            
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
                        console.log ('WARNING, collision detected in pin generation attempt', 1)
                        makePin(attempts, callback)
                        
                    } else {
                        callback (null, text) // no pin collision all good
                    }
                }
            })
        }

        // set timestamp 
        var date = new Date(Date.now())
        ui.date = date

        var startd = new Date(req.body.startdate + " " + req.body.starttime)
        var endd = new Date(req.body.enddate + " " + req.body.endtime)

        // init UI        
        ui.flow.activateDiv = 'create-save-div'
        ui.flow.activateButton = 'create-button'
            

        
        makePin (0, function (err, pincode) {
            if (err) {
                res.status = 500
                ui.data[ui.menuitem].status = '500'
                ui.data[ui.menuitem].response = err
            } else {
            
                // setup data in the model
                var event = Event({
                    event: {
                        name: ui.data.create.response.event.name,
                        location:  ui.data.create.response.event.name,
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
                        ui.data.create.status = '500'
                        ui.data.create.response = err
                    } else {
                        res.status = 201
                        ui.data.create.status = '201'
                        ui.data.create.response = event
                    }

                    // redirect to confirmation screen
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

        ui.flow.activateDiv = 'list-div'
        ui.flow.activateButton=  'list-button'
      
        Event.find({
            'event.start': {
                $gte: startdate,
                $lte: enddate
            }
        }, function (err, events) {


            if (err) {
                ui.data.list.status = '500'
                ui.data.list.response = err
            } else {
                ui.data.list.status = '200'
                ui.data.list.response = events
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
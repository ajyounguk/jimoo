// Jimoo - feedback controler
// web ui and mongo controller for the admin interactions 
//

module.exports = function (app) {

    // ui = data object holds all data required by the UI
    //
    // set ui.debug for json ouput of the data
    //
    // ui.flow.activateDiv = div to be enabled when form loads
    // ui.flow.activateButton = button to be enabled when form loads
    // 
    // ui.data = main data structure for capturing UI inputs/outputs
    // ui.data.create = create screens data
    // ui.data.list = list screens data

    var ui = {
        debug: false,
        flow: {
            activateDiv: 'create-div',
            activateButton: 'create-button',
        },
        data: {
            create: {},
            list: {}
        }
    }

    // init UI helper function
    function initUi(uiElement) {

        if (uiElement == 'create') {

            // calc dates = todays date and time
            var dateNow = new Date(Date.now()).toISOString().split('T')[0]
            var timeNow = new Date(Date.now()).toTimeString().split(' ')[0].substr(0, 5)

            ui.data.create = {
                status: null,
                response: null,
                timestamp: null,
                todayDate: dateNow,
                todayTime: timeNow,
                event: {
                    name: null,
                    location: null,
                    presenter: null,
                    start: null,
                    end: null,
                    email: null,
                    notes: null,
                    pin: null
                }
            }
        }

        if (uiElement = 'list') {

            // calc todays date & todays date + 1 month (for list ui controls)
            var thisYear = new Date(Date.now()).getFullYear()
            var thisMonth = new Date(Date.now()).getMonth() 
            var listStartDate = new Date(thisYear, thisMonth, 2 ).toISOString().split('T')[0]
            var listEndDate = new Date(thisYear, thisMonth +1 , 2).toISOString().split('T')[0]

            ui.data.list = {
                status: null,
                response: null,
                timestamp: null,
                startDate: listStartDate,
                endDate: listEndDate,
                events: []
            }
        }
    }
    // set ui.data.create = object from helper function
    initUi('create')

    // set ui.data.list = object from helper function
    initUi('list')

    

    // load Event model for mongo
    var Event = require('../models/eventModel')

    // setup bodyparser
    var bodyParser = require('body-parser');
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({
        extended: true
    })); // support encoded bodies


    // 0. serve up admin form
    app.get('/', function (req, res) {

        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'create-div'
        ui.flow.activateButton = 'create-button'  


        res.setHeader('Content-Type', 'text/html');
        res.render('./index', {
            ui: ui
        })
    })
    
    // 1a. create event + display confirm screen
    app.post('/admin/event/create', function (req, res) { 

        // init UI        
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'create-confirmation-div'
        ui.flow.activateButton = 'create-button'        

        ui.data.create.event.name = req.body.name
        ui.data.create.event.location = req.body.location
        ui.data.create.event.presenter = req.body.presenter
        ui.data.create.event.email = req.body.email
        ui.data.create.event.notes = req.body.notes
        ui.data.create.event.startdate = req.body.startdate
        ui.data.create.event.starttime = req.body.starttime
        ui.data.create.event.enddate = req.body.enddate
        ui.data.create.event.endtime = req.body.endtime        

        // redirect to confirmation screen
        res.render('./index.ejs', {
            ui: ui
        })
    
    })

    // 1b. save event
    app.post('/admin/event/save', function (req, res) { 
        
        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'create-save-div'
        ui.flow.activateButton = 'create-button'

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

                  
        makePin (0, function (err, pincode) {
            if (err) {
                res.status = 500
                ui.data.create.status = '500'
                ui.data.create.response = err
                console.log(err)
            } else {

                // setup date and time for mongo insert
                var startd = new Date(ui.data.create.event.startdate + " " + ui.data.create.event.starttime)
                var endd = new Date(ui.data.create.event.enddate + " " + ui.data.create.event.endtime)
            
                // setup data in the model
                var event = Event({
                    event: {
                        name: ui.data.create.event.name,
                        location: ui.data.create.event.location,
                        presenter: ui.data.create.event.presenter,
                        email: ui.data.create.event.email,
                        notes: ui.data.create.event.notes,
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
                        console.log(err)
                    } else {
                        res.status = 201
                        ui.data.create.status = '201'
                        ui.data.create.response = event
                    }

                    // redirect to save screen
                    res.render('./index.ejs', {
                        ui: ui
                    })
                })
            }
        })
    })


    // 1c. modify
    app.get('/admin/event/modify', function (req, res) {

        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'create-div'
        ui.flow.activateButton=  'create-button'
        
        res.status(200)
        res.render('./index.ejs', {
            ui: ui
        })
    })
    

    // 1d. cancel
    app.get('/admin/event/cancel', function (req, res) {

        // init ui
        initUi('create')
        var date = new Date(Date.now())
        ui.data.create.timestamp = date    
        ui.flow.activateDiv = 'create-div'
        ui.flow.activateButton=  'create-button'
        
        res.status(200)
        res.render('./index.ejs', {
            ui: ui
        })
    })


    // 2. list
    app.post('/admin/event/list', function (req, res) {

        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.list.timestamp = date    
        ui.flow.activateDiv = 'list-div'
        ui.flow.activateButton=  'list-button'

        // prepare list form dates to be used by mongo filter
        var startdate = new Date(req.body.lstartdate +' 00:00:00')
        var enddate = new Date(req.body.lenddate +' 24:00:00')
      
        Event.find({
            'event.start': {
                $gte: startdate,
                $lte: enddate
            }
        }, function (err, events) {

            if (err) {
                ui.data.list.status = '500'
                ui.data.list.response = err
                console.log(err)
            } else {
                ui.data.list.status = '200'
                ui.data.list.events = events
            }

            res.render('./index.ejs', {
                ui: ui
            })
        })
    })


    // 3. modify existing
    app.get('/admin/events:id', function (req, res) {

        // set timestamp & init ui flow
        var date = new Date(Date.now())
        ui.data.list.timestamp = date    
        ui.flow.activateDiv = 'modify-div'
        ui.flow.activateButton=  'modify-button'

        var mongoid = req.params.id;

        ui.data.create.timestamp = date
        console.log(mongoid)

            res.render('./index.ejs', {
                ui: ui
            })

    })
}
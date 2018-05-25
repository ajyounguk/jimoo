// Jimoo - feedback controler
module.exports = function (app) {


    var ui = {}

    // setup bodyparser
    var bodyParser = require('body-parser');
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({
        extended: true
    })); // support encoded bodies



    // serve up main test page 
    app.get('/', function (req, res) {

        ui = {
            menuitem: 1,
            data: [],
            def_bucket: '',
            def_file: ''
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
<img src="https://github.com/ajyounguk/jimoo/blob/master/public/jimoo.png" width="100" height="100">

## Jimoo - The event feedback tool

## What is this?
Jimoo is a work in progress web app, that will allow you to get feedback for an event/meeting. 

Developed with a Node.js backend, ejs, HTML and a MongoDB database.

![Create Event](/screenshots/createevent.png?raw=true)

![Feedback](/screenshots/feedback.png?raw=true)

![List Events](/screenshots/listevents.png?raw=true)

## Contains:
- app.js = main app & webserver. Launch this and access it with a browser on port 3000
- /controllers = HTTP routes, mongo access controllers, helper functions and. Also includes a setup controller to create test data
- /config = example mongoDB connection/config file
- /public = stylesheet & icons
- screenshots = screenshots
- views = main index.ejs and form HTML partials

### Event admin functionality:
- Create a new event
- List/Search events
- Modify event (from search /event list)
- Delete event (from search /event list)
Todo:
- View feedback for event
- Other stats (splunk?)

### Feedback functionality
- Enter pin + provide feedback
Todo:
- View real time feedback summary

### Further Todos:
- Implement mongo TTL index for events soft deleted
- Angular front end + REST API to replace the messy UI controller... (maybe)


## Installation overview
install Node.js: https://nodejs.org/en/


clone the repo and install modules:

```
git clone https://github.com/ajyounguk/jimoo
cd jimoo
npm install
```

## Mongo Credentials
Copy the configuration details and add your mongo creds.
```
cd config
cp mongo-config-sample.json mongo-config.json
```


## How to run it
run the webserver:

```
node app.js
```

point your browser at the IP:3000/admin to load admin UI or IP:3000 for the feedback UI




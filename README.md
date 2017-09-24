# [EHR-js](https://ehr-js.au-syd.mybluemix.net) 
## Cloud Based Concept with Node.js and Bluemix
[![Build Status](https://travis-ci.org/kemalelmizan/ehr-js.svg?branch=master)](https://travis-ci.org/kemalelmizan/ehr-js)


Libraries used in back end:
- [express](https://github.com/expressjs/express) for routing, app logic, etc
- [node-sqlite](https://github.com/mapbox/node-sqlite3) for accessing sqlite with node
- [Google OAuth2 API](https://github.com/google/google-api-nodejs-client) for authenticating users
- [URSA](https://github.com/JoshKaufman/ursa) for RSA public/private key OpenSSL bindings
- [node-qrcode](https://github.com/soldair/node-qrcode) for generating QR-Codes

Libraries used in front end:
- [html5-qrcode](https://github.com/dwa012/html5-qrcode) for scanning QR-Codes
- [DataTables](https://github.com/DataTables/DataTables) for displaying data

Technologies stack used for development:
- [Node.js](https://nodejs.org) with [Express](https://github.com/expressjs/express) for backend app logic 
- [SQLite](https://www.sqlite.org) for relational database
- [IBM Bluemix](https://www.ibm.com/cloud-computing/bluemix/) for Hosting
- [Cloud Foundry](https://www.cloudfoundry.org) for Deployment
- [Snyk](https://snyk.io) for vulnerability assessment
- [TravisCI](https://travis-ci.org) for continuous integration

Below is Bluemix's Readme for Node.js
# Node.js getting started application
The Bluemix Getting started tutorial for Node.js uses this sample application to provide you with a sample workflow for working with any Node.js app on Bluemix; you set up a development environment, deploy an app locally and on Bluemix, and integrate a Bluemix database service in your app.

The Node.js app uses [Express Framework](https://expressjs.com) and [Cloudant noSQL DB service](https://console.bluemix.net/catalog/services/cloudant-nosql-db) to add information to a database and then return information from a database to the UI. To learn more about how the app connects to Cloudant, see the [Cloudant library for Node.js](https://www.npmjs.com/package/cloudant).

<p align="center">
  <img src="https://raw.githubusercontent.com/IBM-Bluemix/get-started-java/master/docs/GettingStarted.gif" width="300" alt="Gif of the sample app contains a title that says, Welcome, a prompt asking the user to enter their name, and a list of the database contents which are the names Joe, Jane, and Bob. The user enters the name, Mary and the screen refreshes to display, Hello, Mary, I've added you to the database. The database contents listed are now Mary, Joe, Jane, and Bob.">
</p>

The following steps are the general procedure to set up and deploy your app. See more detailed instructions in the [Getting started tutorial for Node.js](https://console.bluemix.net/docs/runtimes/nodejs/getting-started.html#getting-started-with-node-js-on-bluemix).

## Before you begin

You'll need a [Bluemix account](https://console.ng.bluemix.net/registration/), [Git](https://git-scm.com/downloads) [Cloud Foundry CLI](https://github.com/cloudfoundry/cli#downloads) and [Node](https://nodejs.org/en/) installed.

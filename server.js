var express = require("express");
var app = express();
var cfenv = require("cfenv");
var bodyParser = require("body-parser");
var QRCode = require("qrcode");

var rootURL = "https://ehr-js.au-syd.mybluemix.net";

var sqlite3 = require("sqlite3").verbose();
var db = new sqlite3.Database("./databases/main_example.db", err => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the databases/main_example database.");
});

var fs = require("fs"),
  ursa = require("ursa"),
  crt,
  key,
  msg;

// Generate Public and Private keys
// Private
// openssl genrsa -out certs/server/my-server.key.pem 2048
// Public
// openssl rsa -in certs/server/my-server.key.pem -pubout -out certs/client/my-server.pub

key = ursa.createPrivateKey(
  fs.readFileSync("./certs/server/my-server.key.pem")
);
crt = ursa.createPublicKey(fs.readFileSync("./certs/client/my-server.pub"));

console.log("Encrypt with Public");
msg = crt.encrypt("Everything is going to be 200 OK", "utf8", "base64");
console.log("encrypted", msg, "\n");

console.log("Decrypt with Private");
msg = key.decrypt(msg, "base64", "utf8");
console.log("decrypted", msg, "\n");

console.log("############################################");
console.log("Reverse Public -> Private, Private -> Public");
console.log("############################################\n");

console.log("Encrypt with Private (called public)");
msg = key.privateEncrypt("Everything is going to be 200 OK", "utf8", "base64");
console.log("encrypted", msg, "\n");

console.log("Decrypt with Public (called private)");
msg = crt.publicDecrypt(msg, "base64", "utf8");
console.log("decrypted", msg, "\n");

// In memory database:
// var db = new sqlite3.Database(":memory:");

/*
db.serialize(function() {
  db.run("CREATE TABLE lorem (info TEXT)");
  var stmt = db.prepare("INSERT INTO lorem VALUES (?)");
  for (var i = 0; i < 10; i++) {
    stmt.run("Ipsum " + i);
  }
  stmt.finalize();
  db.each("SELECT rowid AS id, info FROM lorem", function(err, row) {
    console.log(row.id + ": " + row.info);
  });
});
*/

db.serialize(() => {
  db.each(
    `SELECT id as id,
            label as label
    FROM test`,
    (err, row) => {
      if (err) {
        console.error(err.message);
      }
      console.log(row.id + "\t" + row.label);
    }
  );
});

db.close(err => {
  if (err) {
    console.error(err.message);
  }
  console.log("Closed the database connection.");
});

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

// Bluemix's NoSQL Database
var mydb;

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
* 	"name": "Bob"
* }
*/

QRCode.toString(rootURL, (err, string) => {
  if (err) throw err;
  console.log(string);
});

app.get("/qr/this", function(request, response) {
  QRCode.toDataURL(rootURL, (err, dataURL) => {
    if (err) throw err;
    response.send(dataURL);
  });
});

app.post("/api/visitors", function(request, response) {
  var userName = request.body.name;
  if (!mydb) {
    console.log("No database.");
    response.send("Hello " + userName + "!");
    return;
  }
  // insert the username as a document
  mydb.insert({ name: userName }, function(err, body, header) {
    if (err) {
      return console.log("[mydb.insert] ", err.message);
    }
    response.send("Hello " + userName + "! I added you to the database.");
  });
});

/**
 * Endpoint to get a JSON array of all the visitors in the database
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * Response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/visitors", function(request, response) {
  var names = [];
  if (!mydb) {
    response.json(names);
    return;
  }

  mydb.list({ include_docs: true }, function(err, body) {
    if (!err) {
      body.rows.forEach(function(row) {
        if (row.doc.name) names.push(row.doc.name);
      });
      response.json(names);
    }
  });
});

// load local VCAP configuration  and service credentials
var vcapLocal;
try {
  vcapLocal = require("./vcap-local.json");
  console.log("Loaded local VCAP", vcapLocal);
} catch (e) {}

const appEnvOpts = vcapLocal ? { vcap: vcapLocal } : {};

const appEnv = cfenv.getAppEnv(appEnvOpts);

if (appEnv.services["cloudantNoSQLDB"]) {
  // Load the Cloudant library.
  var Cloudant = require("cloudant");

  // Initialize database with credentials
  var cloudant = Cloudant(appEnv.services["cloudantNoSQLDB"][0].credentials);

  //database name
  var dbName = "mydb";

  // Create a new "mydb" database.
  cloudant.db.create(dbName, function(err, data) {
    if (
      !err //err if database doesn't already exists
    )
      console.log("Created database: " + dbName);
  });

  // Specify the database we are going to use (mydb)...
  mydb = cloudant.db.use(dbName);
}

//serve static file (index.html, images, css)
app.use(express.static(__dirname + "/views"));

var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log("EHR-js is ready to be served at http://localhost:" + port);
});

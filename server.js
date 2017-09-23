var express = require("express");
var Session = require("express-session");
var cfenv = require("cfenv");
var bodyParser = require("body-parser");
var QRCode = require("qrcode");
var google = require("googleapis");
var config = require("./config");

var OAuth2 = google.auth.OAuth2;
var plus = google.plus("v1");

var app = express();
app.use(
  Session({
    secret: config.SESSION_SECRET,
    resave: true,
    saveUninitialized: true
  })
);

var oauth2Client = new OAuth2(
  config.CLIENT_ID,
  config.CLIENT_SECRET,
  config.REDIRECT_URL
);

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

QRCode.toString(config.ROOT_URL, (err, string) => {
  if (err) throw err;
  console.log(string);
});

app.get("/qr/root", function(request, response) {
  QRCode.toDataURL(config.ROOT_URL, (err, dataURL) => {
    if (err) throw err;
    response.send(dataURL);
  });
});

app.get("/qr/:userId", function(request, response) {
  QRCode.toDataURL(
    config.ROOT_URL + "/" + request.params.userId,
    (err, dataURL) => {
      if (err) throw err;
      response.send(dataURL);
    }
  );
});

app.get("/oauth2url", function(request, response) {
  var url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/plus.me"
  });
  response.send(url);
});

app.get("/oauth2callback", function(req, res) {
  var session = req.session;
  var code = req.query.code; // the query param code
  oauth2Client.getToken(code, function(err, tokens) {
    // Now tokens contains an access_token and an optional refresh_token. Save them.
    if (!err) {
      oauth2Client.setCredentials(tokens);
      //saving the token to current session
      session["tokens"] = tokens;
      res.redirect(config.ROOT_URL);
    } else {
      res.send(`
        <h3>Login failed!!!</h3>
      `);
    }
  });
});

app.get("/logout", function(req, res) {
  req.session["tokens"] = undefined;
  res.redirect(config.ROOT_URL);
});

app.use("/oauth2details", function(req, res) {
  if (req.session["tokens"] === undefined) {
    res.send("0");
  } else {
    oauth2Client.setCredentials(req.session["tokens"]);
    var p = new Promise((resolve, reject) => {
      plus.people.get({ userId: "me", auth: oauth2Client }, (err, response) => {
        resolve(response || err);
      });
    }).then(data => {
      res.send(data);
    });
  }
});

// Bluemix's NoSQL Database
var mydb;

/* Endpoint to greet and add a new visitor to database.
* Send a POST request to localhost:3000/api/visitors with body
* {
* 	"name": "Bob"
* }
*/
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

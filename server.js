var express = require("express");
var Session = require("express-session");
var cfenv = require("cfenv");
var bodyParser = require("body-parser");
var util = require("util");
var QRCode = require("qrcode");
var google = require("googleapis");
var config = require("./config");

var OAuth2 = google.auth.OAuth2;
var plus = google.plus("v1");
var sqlite3 = require("sqlite3").verbose();

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
var db = new sqlite3.Database(config.DB_CONN[0], config.DB_CONN[1]);

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

db.close(config.DB_CLOSE_ERR);

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }));
// parse application/json
app.use(bodyParser.json());

QRCode.toString(config.ROOT_URL, (err, string) => {
  if (err) throw err;
  console.log(string);
});

app.get("/qr/root", function(req, res) {
  QRCode.toDataURL(config.ROOT_URL, (err, dataURL) => {
    if (err) throw err;
    res.send(dataURL);
  });
});

app.get("/qr/:userId", function(req, res) {
  QRCode.toDataURL(
    config.ROOT_URL + "/userdata/" + req.params.userId,
    (err, dataURL) => {
      if (err) throw err;
      res.send(dataURL);
    }
  );
});

app.get("/data/info/:userId", function(req, res) {
  if (req.session["tokens"] === undefined) {
    // res.redirect(config.ROOT_URL);
    res.send({ redirect: config.ROOT_URL });
  } else {
    oauth2Client.setCredentials(req.session["tokens"]);
    var p = new Promise((resolve, reject) => {
      plus.people.get({ userId: "me", auth: oauth2Client }, (err, res) => {
        resolve(res || err);
      });
    }).then(data => {
      // TODO: allow medic userId approved to access this
      if (data.id !== req.params.userId) {
        res.redirect(config.ROOT_URL);
      } else {
        var db = new sqlite3.Database(config.DB_CONN[0], config.DB_CONN[1]);
        var sql = `
          SELECT po.*, 
            ai.ADDR_NAME, ai.HOUSE_NUM, ai.PROVINCE, ai.SUBDISTRICT, ai.VILLAGE, ai.POSTAL_CODE,
            hp.ALLERGIES_ADVERSE_REACT, hp.OPERATION, hp.PROBLEMS, hp.CREATED_DATE, hp.DATE_OPERATION,
            ghi.BLOODPRESSURE, ghi.CHOLESTEROL, ghi.HEIGHT, ghi.WEIGHT, ghi.TEMPERATURE, ghi.CREATED_DATE,
            mi.NAME, mi.DESCRIPTION, mi.CREATED_DATE
          FROM  PATIENT_ORG po
          LEFT OUTER JOIN ADDR_INFO ai ON ai.PATIENT_ORG_ID = po.ROW_ID
          LEFT OUTER JOIN HIST_PATIENT hp ON hp.PATIENT_ORG_ID = po.ROW_ID
          LEFT OUTER JOIN GEN_HEALTH_INFO ghi ON ghi.PATIENT_ORG_ID = po.ROW_ID
          LEFT OUTER JOIN MEDICATION_INFO mi ON mi.PATIENT_ORG_ID = po.ROW_ID
          WHERE po.GOOGLE_ID = ?
        `;
        var resp = {};
        var patientId = 0;

        db.all(sql, [req.params.userId], (err, rows) => {
          if (err) throw err;
          // res.send(row);
          rows.forEach(row => {
            resp = Object.assign(row, resp);
          });

          if (Object.keys(resp).length === 0) {
            res.send("0");
          } else {
            res.send(resp);
          }
          // Object.assign(row, resp);
          // patientId = row.ROW_ID;
          // res.send(util.inspect(row));
        });

        db.close(config.DB_CLOSE_ERR);
      }
    });
  }
});

app.get("/oauth2url", function(req, res) {
  var url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: "https://www.googleapis.com/auth/plus.me"
  });
  res.send(url);
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
        <h3>Login failed.</h3>
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
      plus.people.get({ userId: "me", auth: oauth2Client }, (err, res) => {
        resolve(res || err);
      });
    }).then(data => {
      res.send(data);
    });
  }
});

// INSERT Endpoints
app.post("/insert/patient_org", function(req, res) {
  if (req.session["tokens"] === undefined) {
    // res.redirect(config.ROOT_URL);
    res.send({ redirect: config.ROOT_URL });
  } else {
    oauth2Client.setCredentials(req.session["tokens"]);
    var p = new Promise((resolve, reject) => {
      plus.people.get({ userId: "me", auth: oauth2Client }, (err, res) => {
        resolve(res || err);
      });
    }).then(data => {
      // TODO: allow medic userId approved to access this
      if (data.id !== req.body.GOOGLE_ID) {
        res.send({ redirect: config.ROOT_URL });
      } else {
        var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        var displayName = req.body.FIRST_NAME + " " + req.body.LAST_NAME;
        console.log("POST /insert/patient_org from: " + ip);
        console.log(req.body);

        var db = new sqlite3.Database(config.DB_CONN[0], config.DB_CONN[1]);
        var sql = `
          INSERT INTO PATIENT_ORG
          (${Object.keys(req.body).join(",")}) 
          VALUES (${Object.keys(req.body)
            .map(k => "?")
            .join(",")})
        `;
        db.run(sql, Object.keys(req.body).map(k => req.body[k]), function(err) {
          if (err) return console.log(err.message);
          console.log(
            `Row inserted with rowid ${this.lastID} : for ${displayName}`
          );
        });
        db.close(config.DB_CLOSE_ERR);

        res.send("Hello " + displayName + "! I've added you to the database.");
      }
    });
  }
});

app.post("/insert/addr_info", function(req, res) {
  if (req.session["tokens"] === undefined) {
    // res.redirect(config.ROOT_URL);
    res.send({ redirect: config.ROOT_URL });
  } else {
    oauth2Client.setCredentials(req.session["tokens"]);
    var p = new Promise((resolve, reject) => {
      plus.people.get({ userId: "me", auth: oauth2Client }, (err, res) => {
        resolve(res || err);
      });
    }).then(data => {
      // TODO: allow medic userId approved to access this
      if (data.id !== req.body.GOOGLE_ID) {
        res.send({ redirect: config.ROOT_URL });
      } else {
        var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        console.log("POST /insert/addr_info from: " + ip);
        console.log(req.body);
        delete req.body["GOOGLE_ID"];

        var db = new sqlite3.Database(config.DB_CONN[0], config.DB_CONN[1]);
        var sql = `
          INSERT INTO ADDR_INFO
          (${Object.keys(req.body).join(",")}) 
          VALUES (${Object.keys(req.body)
            .map(k => "?")
            .join(",")})
        `;
        db.run(sql, Object.keys(req.body).map(k => req.body[k]), function(err) {
          if (err) return console.log(err.message);
          console.log(`Row inserted with rowid ${this.lastID}`);
        });
        db.close(config.DB_CLOSE_ERR);

        res.send("Address Info Inserted.");
      }
    });
  }
});

app.post("/insert/gen_health_info", function(req, res) {
  if (req.session["tokens"] === undefined) {
    // res.redirect(config.ROOT_URL);
    res.send({ redirect: config.ROOT_URL });
  } else {
    oauth2Client.setCredentials(req.session["tokens"]);
    var p = new Promise((resolve, reject) => {
      plus.people.get({ userId: "me", auth: oauth2Client }, (err, res) => {
        resolve(res || err);
      });
    }).then(data => {
      // TODO: allow medic userId approved to access this
      if (data.id !== req.body.GOOGLE_ID) {
        res.send({ redirect: config.ROOT_URL });
      } else {
        var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        console.log("POST /insert/gen_health_info from: " + ip);
        console.log(req.body);
        delete req.body["GOOGLE_ID"];

        var db = new sqlite3.Database(config.DB_CONN[0], config.DB_CONN[1]);
        var sql = `
          INSERT INTO GEN_HEALTH_INFO
          (${Object.keys(req.body).join(",")}) 
          VALUES (${Object.keys(req.body)
            .map(k => "?")
            .join(",")})
        `;
        db.run(sql, Object.keys(req.body).map(k => req.body[k]), function(err) {
          if (err) return console.log(err.message);
          console.log(`Row inserted with rowid ${this.lastID}`);
        });
        db.close(config.DB_CLOSE_ERR);

        res.send("General Health Info Inserted.");
      }
    });
  }
});

app.post("/insert/hist_patient", function(req, res) {
  if (req.session["tokens"] === undefined) {
    // res.redirect(config.ROOT_URL);
    res.send({ redirect: config.ROOT_URL });
  } else {
    oauth2Client.setCredentials(req.session["tokens"]);
    var p = new Promise((resolve, reject) => {
      plus.people.get({ userId: "me", auth: oauth2Client }, (err, res) => {
        resolve(res || err);
      });
    }).then(data => {
      // TODO: allow medic userId approved to access this
      if (data.id !== req.body.GOOGLE_ID) {
        res.send({ redirect: config.ROOT_URL });
      } else {
        var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        console.log("POST /insert/hist_patient from: " + ip);
        console.log(req.body);
        delete req.body["GOOGLE_ID"];

        var db = new sqlite3.Database(config.DB_CONN[0], config.DB_CONN[1]);
        var sql = `
          INSERT INTO HIST_PATIENT
          (${Object.keys(req.body).join(",")}) 
          VALUES (${Object.keys(req.body)
            .map(k => "?")
            .join(",")})
        `;
        db.run(sql, Object.keys(req.body).map(k => req.body[k]), function(err) {
          if (err) return console.log(err.message);
          console.log(`Row inserted with rowid ${this.lastID}`);
        });
        db.close(config.DB_CLOSE_ERR);

        res.send("Patient History Inserted.");
      }
    });
  }
});

app.post("/insert/medication_info", function(req, res) {
  if (req.session["tokens"] === undefined) {
    // res.redirect(config.ROOT_URL);
    res.send({ redirect: config.ROOT_URL });
  } else {
    oauth2Client.setCredentials(req.session["tokens"]);
    var p = new Promise((resolve, reject) => {
      plus.people.get({ userId: "me", auth: oauth2Client }, (err, res) => {
        resolve(res || err);
      });
    }).then(data => {
      // TODO: allow medic userId approved to access this
      if (data.id !== req.body.GOOGLE_ID) {
        res.send({ redirect: config.ROOT_URL });
      } else {
        var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
        console.log("POST /insert/hist_patient from: " + ip);
        console.log(req.body);
        delete req.body["GOOGLE_ID"];

        var db = new sqlite3.Database(config.DB_CONN[0], config.DB_CONN[1]);
        var sql = `
          INSERT INTO MEDICATION_INFO
          (${Object.keys(req.body).join(",")}) 
          VALUES (${Object.keys(req.body)
            .map(k => "?")
            .join(",")})
        `;
        db.run(sql, Object.keys(req.body).map(k => req.body[k]), function(err) {
          if (err) return console.log(err.message);
          console.log(`Row inserted with rowid ${this.lastID}`);
        });
        db.close(config.DB_CLOSE_ERR);

        res.send("Medication Info Inserted.");
      }
    });
  }
});

// Bluemix's NoSQL Database
var mydb;

/* Endpoint to greet and add a new visitor to database.
* Send a POST req to localhost:3000/api/visitors with body
* {
* 	"name": "Bob"
* }
*/
app.post("/api/visitors", function(req, res) {
  var userName = req.body.name;
  if (!mydb) {
    console.log("No database.");
    res.send("Hello " + userName + "!");
    return;
  }
  // insert the username as a document
  mydb.insert({ name: userName }, function(err, body, header) {
    if (err) {
      return console.log("[mydb.insert] ", err.message);
    }
    res.send("Hello " + userName + "! I added you to the database.");
  });
});

/**
 * Endpoint to get a JSON array of all the visitors in the database
 * REST API example:
 * <code>
 * GET http://localhost:3000/api/visitors
 * </code>
 *
 * response:
 * [ "Bob", "Jane" ]
 * @return An array of all the visitor names
 */
app.get("/api/visitors", function(req, res) {
  var names = [];
  if (!mydb) {
    res.json(names);
    return;
  }

  mydb.list({ include_docs: true }, function(err, body) {
    if (!err) {
      body.rows.forEach(function(row) {
        if (row.doc.name) names.push(row.doc.name);
      });
      res.json(names);
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
  console.log("Please change config.ROOT_URL before deploying with cf push");
});

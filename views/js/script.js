$(document).ready(function() {
  $("#nameInput").hide();
  $.get("./oauth2details", function(data, textStatus, jqXHR) {
    if (data !== "0") {
      // Logged In
      $("#google-id-profile").append(
        "<div>Welcome, " +
          data.displayName +
          "! <a id='a-logout' href='/logout'>Logout</a></div>"
      );
      $("#google-id-profile").append("<br/>");
      $("#google-id-profile").append("<img src='" + data.image.url + "'/>");

      // Get QR Image
      $.get("./qr/" + data.id, function(data, textStatus, jqXHR) {
        $("#img-qr").attr("src", data);
      });

      // Get Basic Info
      $.get("./data/info/" + data.id, function(data, textStatus, jqXHR) {
        $("#dt-info").DataTable({
          aaSorting: [],
          paging: false,
          columns: [
            {
              data: "key",
              title: "Key"
            },
            {
              data: "value",
              title: "Value"
            }
          ],
          initComplete: function() {
            this.api()
              .rows.add(
                JSON.stringify(data, function(key, value) {
                  if (typeof value === "number") {
                    return value.toString();
                  }
                  if (value === null) {
                    return "";
                  }
                  return value;
                })
                  .slice(2, -2)
                  .split('","')
                  .map(c => ({
                    key: c.split('":"')[0],
                    value: c.split('":"')[1]
                  }))
              )
              .draw();
          }
        });
      });
    } else {
      // Not Logged In
      $.get("./oauth2url", function(data, textStatus, jqXHR) {
        $("#google-oauth2").attr("href", data);
        $("#google-oauth2").show();
      });
    }
  });
});

// $("body").on("click", "#a-logout", function(e) {
//   console.log("logout");
//   e.preventDefault();
// });

var scanning = false;
$("#qr-scan").click(function(event) {
  if (!scanning) {
    scanning = true;
    $("#qr-info").hide();
    $("#qr-error").hide();
    $("#qr-scan").html("Stop scanning");

    $("#qr-reader").show();
    $("#qr-reader").html5_qrcode(
      function(data) {
        $("#qr-info").html("<a href='" + data + "'> " + data + "</a>");
        $("#qr-info").slideDown();
        scanning = false;
        $("#qr-scan").html("Scan QR Code");
        $("#qr-reader").hide();
        setTimeout(function() {
          $("#qr-reader").html5_qrcode_stop();
        }, 1000);
      },
      function(error) {
        //show read errors
        console.warn(error);
      },
      function(videoError) {
        //the video stream could be opened
        console.error(videoError);
        $("#qr-error").html(videoError.name + ":  " + videoError.message);
        $("#qr-error").slideDown();
      }
    );
  } else {
    scanning = false;
    $("#qr-scan").html("Scan QR Code");
    $("#qr-reader").html5_qrcode_stop();
    $("#qr-reader").hide();
  }
  event.preventDefault();
});

//Submit data when enter key is pressed
$("#user_name").keydown(function(e) {
  var name = $("#user_name").val();
  if (e.which == 13 && name.length > 0) {
    //catch Enter key
    //POST request to API to create a new visitor entry in the database
    $.ajax({
      method: "POST",
      url: "./api/visitors",
      contentType: "application/json",
      data: JSON.stringify({ name: name })
    }).done(function(data) {
      $("#response").html(AntiXSS.sanitizeInput(data));
      $("#nameInput").hide();
      getNames();
    });
  }
});

//Retreive all the visitors from the database
function getNames() {
  $.get("./api/visitors").done(function(data) {
    if (data.length > 0) {
      data.forEach(function(element, index) {
        data[index] = AntiXSS.sanitizeInput(element);
      });
      $("#databaseNames").html("Database contents: " + JSON.stringify(data));
    }
  });
}

//Call getNames on page load.
getNames();

"use strict";
var connection = null;

var WebSocket = WebSocket || MozWebSocket;

// Implement bootstrap 3 style button loading support
(function($) {
  $.fn.button = function(action) {
    if (action === 'loading' && this.data('loading-text')) {
      this.data('original-text', this.html()).html(this.data('loading-text')).prop('disabled', true);
      feather.replace();
    }
    if (action === 'reset' && this.data('original-text')) {
      this.html(this.data('original-text')).prop('disabled', false);
      feather.replace();
    }
  };
}(jQuery));

// HTML escaping
var entityMap = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;'
};

function escapeHtml(string) {
  return String(string).replace(/[&<>"'`=\/]/g, function (s) {
    return entityMap[s];
  });
}

function displayStatus(message) {
  $('#status-content').html('<div id="status" class="alert alert-warning alert-dismissable fade show" role="alert"><span>' + escapeHtml(message) + '</span><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>');
}

function displaySuccess(message) {
  $('#status-content').html('<div id="status" class="alert alert-success alert-dismissable fade show" role="alert"><span>' + escapeHtml(message) + '</span><button type="button" class="close" data-dismiss="alert" aria-label="Close"><span aria-hidden="true">&times;</span></button></div>');
}

function dismissStatus() {
  $('.alert').alert('close');
}

// Enable and disable buttons based on connection status
var connectedButtonIds = [
  'systemRestart',
  'networkApproach',
  'networkAddress',
  'networkMask',
  'networkGateway',
  'networkDNS',
  'wifiMode',
  'wifiChannel',
  'wifiSsid',
  'wifiWpa2',
  'wifiNetworkApproach',
  'wifiNetworkAddress',
  'wifiNetworkMask',
  'wifiNetworkGateway',
  'wifiNetworkDNS',
  'romiUp',
  'romiDown',
  'romiTerm',
  'romiKill',
  'romiExtIO0',
  'romiExtIO1',
  'romiExtIO2',
  'romiExtIO3',
  'romiExtIO4',
  'visionUp',
  'visionDown',
  'visionTerm',
  'visionKill',
  'systemReadOnly',
  'systemWritable',
  'visionClient',
  'visionTeam',
  'visionDiscard',
  'addConnectedCamera',
  'addCamera',
  'applicationType'
];
var connectedButtonClasses = [
  'cameraName',
  'cameraPath',
  'cameraAlternatePaths',
  'cameraPixelFormat',
  'cameraWidth',
  'cameraHeight',
  'cameraFps',
  'cameraBrightness',
  'cameraWhiteBalance',
  'cameraExposure',
  'cameraProperties',
  'streamWidth',
  'streamHeight',
  'streamFps',
  'streamCompression',
  'streamDefaultCompression',
  'cameraRemove',
  'cameraCopyConfig',
  'cameraKey'
];
var writableButtonIds = ['networkSave', 'visionSave', 'applicationSave', 'fileUploadButton', 'romiSaveExternalIOConfig', 'romiServiceUploadButton', 'romiCalibrateButton'];
var systemStatusIds = ['systemMemoryFree1s', 'systemMemoryFree5s',
                       'systemMemoryAvail1s', 'systemMemoryAvail5s',
                       'systemCpuUser1s', 'systemCpuUser5s',
                       'systemCpuSystem1s', 'systemCpuSystem5s',
                       'systemCpuIdle1s', 'systemCpuIdle5s',
                       'systemNetwork1s', 'systemNetwork5s',
                       'systemCpuTemp1s', 'systemCpuTemp5s'];

function displayDisconnected() {
  displayReadOnly();
  $('#connectionBadge').removeClass('badge-primary').addClass('badge-secondary').text('Disconnected');
  $('#visionServiceStatus').removeClass('badge-primary').removeClass('badge-secondary').addClass('badge-dark').text('Unknown Status');
  $('.cameraConnectionBadge').removeClass('badge-primary').removeClass('badge-secondary').addClass('badge-dark').text('Unknown Status');
  for (var i = 0; i < connectedButtonIds.length; i++) {
    $('#' + connectedButtonIds[i]).prop('disabled', true);
  }
  for (var i = 0; i < connectedButtonClasses.length; i++) {
    $('.' + connectedButtonClasses[i]).prop('disabled', true);
  }
  for (var i = 0; i < systemStatusIds.length; i++) {
    $('#' + systemStatusIds[i]).text("");
  }
}

function displayConnected() {
  $('#connectionBadge').removeClass('badge-secondary').addClass('badge-primary').text('Connected');
  for (var i = 0; i < connectedButtonIds.length; i++) {
    $('#' + connectedButtonIds[i]).prop('disabled', false);
  }
  for (var i = 0; i < connectedButtonClasses.length; i++) {
    $('.' + connectedButtonClasses[i]).prop('disabled', false);
  }
}

// Enable and disable buttons based on writable status
function displayReadOnly() {
  for (var i = 0; i < writableButtonIds.length; i++) {
    $('#' + writableButtonIds[i]).prop('disabled', true);
  }
  $('#systemReadOnly').addClass('active').prop('aria-pressed', true);
  $('#systemWritable').removeClass('active').prop('aria-pressed', false);
}

function displayWritable() {
  for (var i = 0; i < writableButtonIds.length; i++) {
    $('#' + writableButtonIds[i]).prop('disabled', false);
  }
  $('#systemReadOnly').removeClass('active').prop('aria-pressed', false);
  $('#systemWritable').addClass('active').prop('aria-pressed', true);
}

// Handle Read-Only and Writable buttons
$('#systemReadOnly').click(function() {
  var $this = $(this);
  if ($this.hasClass('active')) return;
  var msg = {
    type: 'systemReadOnly'
  };
  connection.send(JSON.stringify(msg));
});

$('#systemWritable').click(function() {
  var $this = $(this);
  if ($this.hasClass('active')) return;
  var msg = {
    type: 'systemWritable'
  };
  connection.send(JSON.stringify(msg));
});

// Vision settings
var visionSettingsServer = {'cameras': [], 'switched cameras': []};
var visionSettingsDisplay = {'cameras': [], 'switched cameras': []};
var cameraList = [];

function pushVisionLogEnabled() {
  var msg = {
    type: 'visionLogEnabled',
    value: visionLogEnabled.prop('checked')
  };
  connection.send(JSON.stringify(msg));
}

function pushRomiLogEnabled() {
  var msg = {
    type: 'romiLogEnabled',
    value: romiLogEnabled.prop('checked')
  };
  connection.send(JSON.stringify(msg));
}

function updateRomiRobotPorts() {
  // Starting channel numbers
  var digitalChannel = 8;
  var analogChannel = 0;
  var pwmChannel = 2;

  for (var i = 0; i < 5; i++) {
    var chType = $("#romiExtIO" + i).val();
    switch (chType) {
      case "dio":
        $("#romiRobotPort" + i).html("Digital " + digitalChannel);
        digitalChannel++;
        break;
      case "ain":
        $("#romiRobotPort" + i).html("Analog In " + analogChannel);
        analogChannel++;
        break;
      case "pwm":
        $("#romiRobotPort" + i).html("PWM " + pwmChannel);
        pwmChannel++;
        break;
    }
  }
}

// WebSocket automatic reconnection timer
var reconnectTimerId = 0;

// Establish WebSocket connection
function connect() {
  if (connection && connection.readyState !== WebSocket.CLOSED) return;
  var serverUrl = "ws://" + window.location.hostname;
  if (window.location.port !== '') {
    serverUrl += ':' + window.location.port;
  }
  connection = new WebSocket(serverUrl, 'frcvision');
  connection.onopen = function(evt) {
    if (reconnectTimerId) {
      window.clearInterval(reconnectTimerId);
      reconnectTimerId = 0;
    }
    displayConnected();
    pushVisionLogEnabled();
    pushRomiLogEnabled();
  };
  connection.onclose = function(evt) {
    displayDisconnected();
    if (!reconnectTimerId) {
      reconnectTimerId = setInterval(function() { connect(); }, 2000);
    }
  };
  // WebSocket incoming message handling
  connection.onmessage = function(evt) {
    var msg = JSON.parse(evt.data);
    if (msg === null) {
      return;
    }

    switch (msg.type) {
      case 'romiEnable':
        $('#romi-nav-item').removeAttr('style');
        $('#wifiSettings').removeAttr('style');
        break;
      case 'systemStatus':
        for (var i = 0; i < systemStatusIds.length; i++) {
          $('#' + systemStatusIds[i]).text(msg[systemStatusIds[i]]);
        }
        break;
      case 'visionStatus':
        var elem = $('#visionServiceStatus');
        if (msg.visionServiceStatus) {
          elem.text(msg.visionServiceStatus);
        }
        if (msg.visionServiceEnabled && !elem.hasClass('badge-primary')) {
          elem.removeClass('badge-dark').removeClass('badge-secondary').addClass('badge-primary');
        } else if (!msg.visionServiceEnabled && !elem.hasClass('badge-secondary')) {
          elem.removeClass('badge-dark').removeClass('badge-primary').addClass('badge-secondary');
        }
        break;
      case 'visionLog':
        visionLog(msg.data);
        break;
      case 'romiStatus':
        var elem = $('#romiServiceStatus');
        if (msg.romiServiceStatus) {
          elem.text(msg.romiServiceStatus);
        }
        if (msg.romiServiceEnabled && !elem.hasClass('badge-primary')) {
          elem.removeClass('badge-dark').removeClass('badge-secondary').addClass('badge-primary');
        } else if (!msg.romiServiceEnabled && !elem.hasClass('badge-secondary')) {
          elem.removeClass('badge-dark').removeClass('badge-primary').addClass('badge-secondary');
        }
        break;
      case 'romiFirmwareInterface':
        $('#romiFirmwareUpdate').prop('disabled', !msg.exists);
        break;
      case 'romiFirmwareComplete':
        $('#romiFirmwareUpdate').button('reset');
        break;
      case 'romiLog':
        romiLog(msg.data);
        break;
      case 'romiFirmwareLog':
        romiFirmwareLog(msg.data);
        break;
      case 'romiConfig':
        // Pre-fill the IO config dropdowns
        if (msg.romiConfig && msg.romiConfig.ioConfig) {
          for (var i = 0; i < msg.romiConfig.ioConfig.length; i++) {
            $('#romiExtIO' + i).val(msg.romiConfig.ioConfig[i]);
          }
          updateRomiRobotPorts();
        }

        // Pre-fill the saved gyro offset
        if (msg.romiConfig && msg.romiConfig.gyroZeroOffset) {
          var gyroOffsets = msg.romiConfig.gyroZeroOffset;
          $("#romiCalibrationXValue").html(gyroOffsets.x.toFixed(3));
          $("#romiCalibrationYValue").html(gyroOffsets.y.toFixed(3));
          $("#romiCalibrationZValue").html(gyroOffsets.z.toFixed(3));
        }
        break;
      case 'romiServiceUploadComplete':
        $('#romiServiceUploadButton').button('reset');
        updateRomiServiceUploadView();
        if (msg.success) {
          displaySuccess('Romi WebService successfully uploaded!');
        }
        break;
      case 'networkSettings':
        $('#networkApproach').val(msg.networkApproach);
        $('#networkAddress').val(msg.networkAddress);
        $('#networkMask').val(msg.networkMask);
        $('#networkGateway').val(msg.networkGateway);
        $('#networkDNS').val(msg.networkDNS);
        $('#wifiMode').val(msg.wifiMode);
        $('#wifiChannel').val(msg.wifiChannel);
        $('#wifiSsid').val(msg.wifiSsid);
        $('#wifiWpa2').val(msg.wifiWpa2);
        $('#wifiNetworkApproach').val(msg.wifiNetworkApproach);
        $('#wifiNetworkAddress').val(msg.wifiNetworkAddress);
        $('#wifiNetworkMask').val(msg.wifiNetworkMask);
        $('#wifiNetworkGateway').val(msg.wifiNetworkGateway);
        $('#wifiNetworkDNS').val(msg.wifiNetworkDNS);
        updateNetworkSettingsView();
        updateWifiNetworkSettingsView();
        updateWifiModeView();
        break;
      case 'visionSettings':
        visionSettingsServer = msg.settings;
        visionSettingsDisplay = $.extend(true, {'cameras': [], 'switched cameras': []}, visionSettingsServer);
        updateVisionSettingsView();
        break;
      case 'applicationSettings':
        $('#applicationType').val(msg.applicationType);
        updateApplicationView();
        break;
      case 'applicationSaveComplete':
        $('#applicationSave').button('reset');
        updateApplicationView();
        displaySuccess('Application successfully uploaded!  See the Vision Status tab for status and console output');
        break;
      case 'fileUploadComplete':
        $('#fileUploadButton').button('reset');
        updateFileUploadView();
        if (msg.success) {
          displaySuccess('File successfully uploaded!');
        }
        break;
      case 'systemReadOnly':
        displayReadOnly();
        break;
      case 'systemWritable':
        displayWritable();
        break;
      case 'status':
        displayStatus(msg.message);
        break;
      case 'cameraList':
        cameraList = msg.cameras;
        updateCameraListView();
        break;
    }
  };
}

// Button handlers
$('#systemRestart').click(function() {
  var msg = {
    type: 'systemRestart'
  };
  connection.send(JSON.stringify(msg));
});

$('#visionUp').click(function() {
  var msg = {
    type: 'visionUp'
  };
  connection.send(JSON.stringify(msg));
});

$('#visionDown').click(function() {
  var msg = {
    type: 'visionDown'
  };
  connection.send(JSON.stringify(msg));
});

$('#visionTerm').click(function() {
  var msg = {
    type: 'visionTerm'
  };
  connection.send(JSON.stringify(msg));
});

$('#visionKill').click(function() {
  var msg = {
    type: 'visionKill'
  };
  connection.send(JSON.stringify(msg));
});

$('#visionLogEnabled').change(function() {
  pushVisionLogEnabled();
});

$('#romiUp').click(function() {
  var msg = {
    type: 'romiUp'
  };
  connection.send(JSON.stringify(msg));
});

$('#romiDown').click(function() {
  var msg = {
    type: 'romiDown'
  };
  connection.send(JSON.stringify(msg));
});

$('#romiTerm').click(function() {
  var msg = {
    type: 'romiTerm'
  };
  connection.send(JSON.stringify(msg));
});

$('#romiKill').click(function() {
  var msg = {
    type: 'romiKill'
  };
  connection.send(JSON.stringify(msg));
});

$('#romiFirmwareUpdate').click(function() {
  $('#romiFirmwareUpdate').button('loading');
  $('#romiFirmwareConsole').removeAttr('style');

  var msg = {
    type: 'romiFirmwareUpdate'
  };
  connection.send(JSON.stringify(msg));
});

$('#romiLogEnabled').change(function() {
  pushRomiLogEnabled();
});

$('#romiSaveExternalIOConfig').click(function() {
  var ioConfig = [];

  for (var i = 0; i < 5; i++) {
    ioConfig.push($('#romiExtIO' + i).val());
  }

  var msg = {
    type: 'romiSaveExternalIOConfig',
    romiConfig: {
      ioConfig: ioConfig
    }
  };
  connection.send(JSON.stringify(msg));
});

// Set up the Romi status query
setInterval(function() {
  var baseUrl = "http://" + window.location.hostname + ":9001";
  fetch(baseUrl + "/status")
  .then(function(response) { return response.json(); })
  .then(function(status) {
    if (status["service-version"]) {
      $("#romiServiceVersion").html(status["service-version"].serviceVersion);
    }
    else {
      $("#romiServiceVersion").html("---");
    }

    if (status["firmware-status"]) {
      var firmwareCompatString = status["firmware-status"].firmwareMatch ?
                                    "<span class='font-weight-bold text-success'>Yes</span>" :
                                    "<span class='font-weight-bold text-danger'>No</span>";
      $("#romiFirmwareCompatible").html(firmwareCompatString);
    }
    else {
      $("#romiFirmwareCompatible").html("---");
    }

    if (status["battery-status"]) {
      $("#romiBatteryVoltage").html(status["battery-status"].voltage.toFixed(2));
    }
    else {
      $("#romiBatteryVoltage").html("---");
    }
  })
  .catch(function (err) {
    $("#romiServiceVersion").html("---");
    $("#romiFirmwareCompatible").html("---");
    $("#romiBatteryVoltage").html("---");
  });

}, 2000);

//
// Vision console output
//
var visionConsole = document.getElementById('visionConsole');
var visionLogEnabled = $('#visionLogEnabled');
var _linesLimit = 100;

/*
function escape_for_html(txt) {
  return txt.replace(/[&<>]/gm, function(str) {
    if (str == "&") return "&amp;";
    if (str == "<") return "&lt;";
    if (str == ">") return "&gt;";
  });
}
*/

function visionLog(data) {
  if (!visionLogEnabled.prop('checked')) {
    return;
  }
  var wasScrolledBottom = (visionConsole.scrollTop === (visionConsole.scrollHeight - visionConsole.offsetHeight));
  var div = document.createElement('div');
  var p = document.createElement('p');
  p.className = 'inner-line';

  // escape HTML tags
  data = escapeHtml(data);
  p.innerHTML = data;

  div.className = 'line';
  div.addEventListener('click', function click() {
    if (this.className.indexOf('selected') === -1) {
      this.className = 'line-selected';
    } else {
      this.className = 'line';
    }
  });

  div.appendChild(p);
  visionConsole.appendChild(div);

  if (visionConsole.children.length > _linesLimit) {
    visionConsole.removeChild(visionConsole.children[0]);
  }

  if (wasScrolledBottom) {
    visionConsole.scrollTop = visionConsole.scrollHeight;
  }
}

//
// Romi console output
//
var romiConsole = document.getElementById('romiConsole');
var romiLogEnabled = $('#romiLogEnabled');
var _linesLimit = 100;

function romiLog(data) {
  if (!romiLogEnabled.prop('checked')) {
    return;
  }
  var wasScrolledBottom = (romiConsole.scrollTop === (romiConsole.scrollHeight - romiConsole.offsetHeight));
  var div = document.createElement('div');
  var p = document.createElement('p');
  p.className = 'inner-line';

  // escape HTML tags
  data = escapeHtml(data);
  p.innerHTML = data;

  div.className = 'line';
  div.addEventListener('click', function click() {
    if (this.className.indexOf('selected') === -1) {
      this.className = 'line-selected';
    } else {
      this.className = 'line';
    }
  });

  div.appendChild(p);
  romiConsole.appendChild(div);

  if (romiConsole.children.length > _linesLimit) {
    romiConsole.removeChild(romiConsole.children[0]);
  }

  if (wasScrolledBottom) {
    romiConsole.scrollTop = romiConsole.scrollHeight;
  }
}

var romiFirmwareConsole = document.getElementById('romiFirmwareConsole');

function romiFirmwareLog(data) {
  var wasScrolledBottom = (romiFirmwareConsole.scrollTop === (romiFirmwareConsole.scrollHeight - romiFirmwareConsole.offsetHeight));
  var div = document.createElement('div');
  var p = document.createElement('p');
  p.className = 'inner-line';

  // escape HTML tags
  data = escapeHtml(data);
  p.innerHTML = data;

  div.className = 'line';
  div.addEventListener('click', function click() {
    if (this.className.indexOf('selected') === -1) {
      this.className = 'line-selected';
    } else {
      this.className = 'line';
    }
  });

  div.appendChild(p);
  romiFirmwareConsole.appendChild(div);

  if (wasScrolledBottom) {
    romiFirmwareConsole.scrollTop = romiFirmwareConsole.scrollHeight;
  }
}

// Show details when appropriate for network approach
function updateNetworkSettingsView() {
  if ($('#networkApproach').val() === "dhcp") {
    $('#networkIpDetails').collapse('hide');
  } else {
    $('#networkIpDetails').collapse('show');
  }
}

$('#networkApproach').change(function() {
  updateNetworkSettingsView();
});

// Show details when appropriate for wifi network approach
function updateWifiNetworkSettingsView() {
  if ($('#wifiNetworkApproach').val() === "dhcp") {
    $('#wifiNetworkIpDetails').collapse('hide');
  } else {
    $('#wifiNetworkIpDetails').collapse('show');
  }
}

$('#wifiNetworkApproach').change(function() {
  updateWifiNetworkSettingsView();
});

// Show details when appropriate for wifi mode
function updateWifiModeView() {
  if ($('#wifiMode').val() === "bridge") {
    $('#wifiAccessPointDetails').collapse('hide');
  } else {
    $('#wifiAccessPointDetails').collapse('show');
    $('#wifiNetworkApproach').val('static');
    updateWifiNetworkSettingsView();
  }
}

$('#wifiMode').change(function() {
  updateWifiModeView();
});

// Network Save button handler
$('#networkSave').click(function() {
  var msg = {
    type: 'networkSave',
    networkApproach: $('#networkApproach').val(),
    networkAddress: $('#networkAddress').val(),
    networkMask: $('#networkMask').val(),
    networkGateway: $('#networkGateway').val(),
    networkDNS: $('#networkDNS').val(),
    wifiMode: $('#wifiMode').val(),
    wifiChannel: parseInt($('#wifiChannel').val()) || 0,
    wifiSsid: $('#wifiSsid').val(),
    wifiWpa2: $('#wifiWpa2').val(),
    wifiNetworkApproach: $('#wifiNetworkApproach').val(),
    wifiNetworkAddress: $('#wifiNetworkAddress').val(),
    wifiNetworkMask: $('#wifiNetworkMask').val(),
    wifiNetworkGateway: $('#wifiNetworkGateway').val(),
    wifiNetworkDNS: $('#wifiNetworkDNS').val()
  };
  connection.send(JSON.stringify(msg));
});

// Show details when appropriate for NT client
$('#visionClient').change(function() {
  if (this.checked) {
    $('#visionClientDetails').collapse('show');
  } else {
    $('#visionClientDetails').collapse('hide');
  }
});

function getCameraPropertyValue(data, name) {
  if (data === null) {
    return null;
  }
  for (var i = 0; i < data.length; i++) {
    if (data[i].name === name) {
      return data[i].value;
    }
  }
  return null;
}

function updateVisionCameraView(camera, value) {
  if ('name' in value) {
    camera.find('.cameraTitle').text('Camera ' + value.name);
    camera.find('.cameraName').val(value.name);
  }
  if ('path' in value) {
    camera.find('.cameraPath').val(value.path);
  }
  camera.find('.cameraPixelFormat').val(value['pixel format']);
  camera.find('.cameraWidth').val(value.width);
  camera.find('.cameraHeight').val(value.height);
  camera.find('.cameraFps').val(value.fps);
  camera.find('.cameraBrightness').val(value.brightness);
  camera.find('.cameraWhiteBalance').val(value['white balance']);
  camera.find('.cameraExposure').val(value.exposure);
  camera.find('.cameraProperties').val(JSON.stringify(value.properties));
  if ('stream' in value && 'properties' in value.stream) {
    camera.find('.streamWidth').val(getCameraPropertyValue(value.stream.properties, 'width'));
    camera.find('.streamHeight').val(getCameraPropertyValue(value.stream.properties, 'height'));
    camera.find('.streamFps').val(getCameraPropertyValue(value.stream.properties, 'fps'));
    camera.find('.streamCompression').val(getCameraPropertyValue(value.stream.properties, 'compression'));
    camera.find('.streamDefaultCompression').val(getCameraPropertyValue(value.stream.properties, 'default_compression'));
  } else {
    camera.find('.streamWidth').val('');
    camera.find('.streamHeight').val('');
    camera.find('.streamFps').val('');
    camera.find('.streamCompression').val('');
    camera.find('.streamDefaultCompression').val('');
  }
}

function updateVisionCameraDataFromJson(i, data) {
  if (!('name' in data)) {
    data.name = visionSettingsDisplay.cameras[i].name;
  }
  if (!('path' in data)) {
    data.path = visionSettingsDisplay.cameras[i].path;
  }
  if ('properties' in data) {
    var newProps = [];
    var wbAuto = false;
    var exAuto = false;

    for (var j = 0; j < data.properties.length; j++) {
      var name = data.properties[j].name;

      // remove all raw properties
      if (name.startsWith('raw_')) {
        continue;
      }

      // brightness
      if (name === 'brightness') {
        data.brightness = data.properties[j].value;
        continue;
      }

      // white balance
      if (name === 'white_balance_temperature_auto') {
        if (data.properties[j].value === true) {
          data['white balance'] = 'auto';
          wbAuto = true;
        }
        continue;
      }
      if (name === 'white_balance_temperature') {
        if (wbAuto === false) {
          data['white balance'] = data.properties.white_balance_temperature;
        }
        continue;
      }

      // exposure
      if (name === 'exposure_auto') {
        if (data.properties[j].value === 3) {
          data.exposure = 'auto';
          exAuto = true;
        }
        continue;
      }
      if (name === 'exposure_absolute') {
        if (exAuto === false) {
          data.exposure = data.properties.exposure_absolute;
        }
        continue;
      }
      newProps.push(data.properties[j]);
    }
    data.properties = newProps;
  }
  visionSettingsDisplay.cameras[i] = data;
}

function appendNewVisionCameraView(value, i) {
  var camera = $('#cameraNEW').clone();
  camera.attr('id', 'camera' + i);
  camera.addClass('cameraSetting');
  camera.removeAttr('style');

  updateVisionCameraView(camera, value);
  camera.find('.cameraStream').attr('href', 'http://' + window.location.hostname + ':' + (1181 + i) + '/');
  camera.find('.cameraRemove').click(function() {
    visionSettingsDisplay.cameras.splice(i, 1);
    camera.remove();
    updateCameraListView();
  });
  camera.find('.cameraSettingsFile').change(function() {
    if (this.files.length <= 0) {
      return false;
    }
    var fr = new FileReader();
    fr.onload = function(e) {
      var result = JSON.parse(e.target.result);
      updateVisionCameraDataFromJson(i, result);
      updateVisionCameraView(camera, result);
    };
    fr.readAsText(this.files.item(0));
  });
  camera.find('.cameraCopyConfig').click(function() {
    fetch('http://' + window.location.hostname + ':' + (1181 + i) + '/config.json')
    .then(response => response.json())
    .then(function(result) {
      updateVisionCameraDataFromJson(i, result);
      updateVisionCameraView(camera, result);
    })
    .catch(function(error) {
      displayStatus('error reading camera config: ' + error);
    });
  });

  camera.find('[id]').each(function() {
    $(this).attr('id', $(this).attr('id').replace('NEW', i));
  });
  camera.find('[for]').each(function() {
    $(this).attr('for', $(this).attr('for').replace('NEW', i));
  });
  camera.find('[data-target]').each(function() {
    $(this).attr('data-target', $(this).attr('data-target').replace('NEW', i));
  });
  camera.find('[aria-labelledby]').each(function() {
    $(this).attr('aria-labelledby', $(this).attr('aria-labelledby').replace('NEW', i));
  });

  $('#cameras').append(camera);
}

function updateVisionSwitchedCameraView(camera, value) {
  if ('name' in value) {
    camera.find('.cameraTitle').text('Switched Camera ' + value.name);
    camera.find('.cameraName').val(value.name);
  }
  if ('key' in value) {
    camera.find('.cameraKey').val(value.key);
  }
}

function appendNewVisionSwitchedCameraView(value, i) {
  var camera = $('#switchedCameraNEW').clone();
  camera.attr('id', 'switchedCamera' + i);
  camera.addClass('cameraSetting');
  camera.removeAttr('style');

  updateVisionSwitchedCameraView(camera, value);
  camera.find('.cameraStream').attr('href', 'http://' + window.location.hostname + ':' + (1181 + visionSettingsDisplay.cameras.length + i) + '/');
  camera.find('.cameraRemove').click(function() {
    visionSettingsDisplay['switched cameras'].splice(i, 1);
    camera.remove();
  });

  camera.find('[id]').each(function() {
    $(this).attr('id', $(this).attr('id').replace('NEW', i));
  });
  camera.find('[for]').each(function() {
    $(this).attr('for', $(this).attr('for').replace('NEW', i));
  });
  camera.find('[data-target]').each(function() {
    $(this).attr('data-target', $(this).attr('data-target').replace('NEW', i));
  });
  camera.find('[aria-labelledby]').each(function() {
    $(this).attr('aria-labelledby', $(this).attr('aria-labelledby').replace('NEW', i));
  });

  $('#switchedCameras').append(camera);
}

function updateVisionSettingsView() {
  var isClient = !visionSettingsDisplay.ntmode || visionSettingsDisplay.ntmode === 'client';
  $('#visionClient').prop('checked', isClient);
  if (isClient) {
    $('#visionClientDetails').collapse('show');
  } else {
    $('#visionClientDetails').collapse('hide');
  }
  $('#visionTeam').val(visionSettingsDisplay.team);

  $('.cameraSetting').remove();
  visionSettingsDisplay.cameras.forEach(function (value, i) {
    appendNewVisionCameraView(value, i);
  });
  visionSettingsDisplay['switched cameras'].forEach(function (value, i) {
    appendNewVisionSwitchedCameraView(value, i);
  });
  updateCameraListView();
  feather.replace();
}

$('#visionSave').click(function() {
  // update json from view
  visionSettingsDisplay.ntmode = $('#visionClient').prop('checked') ? 'client' : 'server';
  visionSettingsDisplay.team = parseInt($('#visionTeam').val(), 10);
  visionSettingsDisplay.cameras.forEach(function (value, i) {
    var camera = $('#camera' + i);
    value.name = camera.find('.cameraName').val();
    value.path = camera.find('.cameraPath').val();
    value['pixel format'] = camera.find('.cameraPixelFormat').val();
    value.width = parseInt(camera.find('.cameraWidth').val(), 10);
    if (isNaN(value.width)) {
      delete value["width"];
    }
    value.height = parseInt(camera.find('.cameraHeight').val(), 10);
    if (isNaN(value.height)) {
      delete value["height"];
    }
    value.fps = parseInt(camera.find('.cameraFps').val(), 10);
    if (isNaN(value.fps)) {
      delete value["fps"];
    }

    var brightness = camera.find('.cameraBrightness').val();
    if (brightness !== '') {
      value.brightness = parseInt(brightness);
      if (isNaN(value.brightness)) {
        value.brightness = brightness;
      }
    } else {
      delete value['brightness'];
    }

    var whiteBalance = camera.find('.cameraWhiteBalance').val();
    if (whiteBalance !== '') {
      value['white balance'] = parseInt(whiteBalance);
      if (isNaN(value['white balance'])) {
        value['white balance'] = whiteBalance;
      }
    } else {
      delete value['white balance'];
    }

    var exposure = camera.find('.cameraExposure').val();
    if (exposure !== '') {
      value.exposure = parseInt(exposure);
      if (isNaN(value.exposure)) {
        value.exposure = exposure;
      }
    } else {
      delete value['exposure'];
    }

    try {
      value.properties = JSON.parse(camera.find('.cameraProperties').val());
    } catch (err) {
      delete value['properties'];
    }

    value.stream = {'properties': []};

    var streamWidth = parseInt(camera.find('.streamWidth').val(), 10);
    if (!isNaN(streamWidth)) {
      value.stream.properties.push({'name': 'width', 'value': streamWidth});
    }

    var streamHeight = parseInt(camera.find('.streamHeight').val(), 10);
    if (!isNaN(streamHeight)) {
      value.stream.properties.push({'name': 'height', 'value': streamHeight});
    }

    var streamFps = parseInt(camera.find('.streamFps').val(), 10);
    if (!isNaN(streamFps)) {
      value.stream.properties.push({'name': 'fps', 'value': streamFps});
    }

    var streamCompression = parseInt(camera.find('.streamCompression').val(), 10);
    if (!isNaN(streamCompression)) {
      value.stream.properties.push({'name': 'compression', 'value': streamCompression});
    }

    var streamDefaultCompression = parseInt(camera.find('.streamDefaultCompression').val(), 10);
    if (!isNaN(streamDefaultCompression)) {
      value.stream.properties.push({'name': 'default_compression', 'value': streamDefaultCompression});
    }
  });
  visionSettingsDisplay['switched cameras'].forEach(function (value, i) {
    var camera = $('#switchedCamera' + i);
    value.name = camera.find('.cameraName').val();
    value.key = camera.find('.cameraKey').val();
  });
  var msg = {
    type: 'visionSave',
    settings: visionSettingsDisplay
  };
  connection.send(JSON.stringify(msg));
});

$('#visionDiscard').click(function() {
  visionSettingsDisplay = $.extend(true, {}, visionSettingsServer);
  updateVisionSettingsView();
});

$('#addUsbCamera').click(function() {
  var i = visionSettingsDisplay.cameras.length;
  visionSettingsDisplay.cameras.push({});
  appendNewVisionCameraView({}, i);
  updateCameraListView();
  $('#cameraBody' + i).collapse('show');
});

$('#addSwitchedCamera').click(function() {
  var i = visionSettingsDisplay['switched cameras'].length;
  visionSettingsDisplay['switched cameras'].push({});
  appendNewVisionSwitchedCameraView({}, i);
  $('#switchedCameraBody' + i).collapse('show');
});

function updateCameraListView() {
  var addConnectedDropdown = $('#addConnectedCameraList');
  addConnectedDropdown.html('');

  // disable all the alternate paths by default
  visionSettingsDisplay.cameras.forEach(function (value, k) {
    var cameraElem = $('#camera' + k);
    cameraElem.find('.cameraConnectionBadge').removeClass('badge-dark').removeClass('badge-primary').addClass('badge-secondary').text('Disconnected');
    cameraElem.find('.cameraAlternatePathsList').html('');
    cameraElem.find('.cameraAlternatePaths').prop('disabled', true);
  });

  cameraList.forEach(function (camera, i) {
    // See if one of the paths is an already existing camera
    // Include the "main path" as the first path
    var matchedCamera = false;
    var paths = [camera.path];
    camera.otherPaths.forEach(function (path, j) {
      paths.push(path);
    });
    paths.forEach(function (path, j) {
      visionSettingsDisplay.cameras.forEach(function (value, k) {
        var cameraElem = $('#camera' + k);
        var pathElem = cameraElem.find('.cameraPath');
        if (path === pathElem.val()) {
          matchedCamera = true;

          // show camera as connected
          cameraElem.find('.cameraConnectionBadge').removeClass('badge-dark').removeClass('badge-secondary').addClass('badge-primary').text('Connected');

          // build alternate path list
          var setAlternateDropdown = cameraElem.find('.cameraAlternatePathsList');
          setAlternateDropdown.html('');
          paths.forEach(function (altPath, j) {
            setAlternateDropdown.append('<button class="dropdown-item cameraSetAlternatePath" type="button">' + altPath + '</button>');
          });

          cameraElem.find('.cameraAlternatePaths').prop('disabled', setAlternateDropdown.html() === '');

          // hook up dropdown items to set alternate path
          setAlternateDropdown.find('.cameraSetAlternatePath').click(function() {
            pathElem.val($(this).text());
          });
        }
      });
    });

    if (!matchedCamera) {
      // add it to add connected camera list
      addConnectedDropdown.append('<h5 class="dropdown-header">' + camera.name + '</h5>');
      paths.forEach(function (path, j) {
        addConnectedDropdown.append('<button class="dropdown-item addConnectedCameraItem" type="button">' + path + '</button>');
      });
    }
  });

  $('#addConnectedCamera').prop('disabled', addConnectedDropdown.html() === '');

  // hook up dropdown items to create cameras
  addConnectedDropdown.find('.addConnectedCameraItem').click(function() {
    var i = visionSettingsDisplay.cameras.length;
    var camera = {"path": $(this).text()};
    visionSettingsDisplay.cameras.push(camera);
    appendNewVisionCameraView(camera, i);
    updateCameraListView();
    $('#cameraBody' + i).collapse('show');
  });
}

var applicationFiles = [];

// Show details when appropriate for application type
function updateApplicationView() {
  if ($('#applicationType').val().startsWith("upload")) {
    $('#applicationUpload').collapse('show');
    $('#applicationSaveText').text('Upload and Save');
  } else {
    $('#applicationUpload').collapse('hide');
    $('#applicationSaveText').text('Save');
  }
  $('#applicationFile').val(null);
  applicationFiles = [];
}

$('#applicationType').change(function() {
  updateApplicationView();
  dismissStatus();
});

$('#applicationFile').change(function() {
  applicationFiles = this.files;
  dismissStatus();
});

$('#applicationSave').click(function() {
  var msg = {
    type: 'applicationSave',
    applicationType: $('#applicationType').val()
  };
  connection.send(JSON.stringify(msg));

  // upload the file if requested
  if (applicationFiles.length <= 0) {
    return;
  }

  $('#applicationSave').button('loading');

  var msg = {
    type: 'applicationStartUpload',
    applicationType: $('#applicationType').val()
  };
  connection.send(JSON.stringify(msg));

  var reader = new FileReader();
  var file = applicationFiles.item(0);

  function uploadFile(start) {
    var nextSlice = start + (64 * 1024) + 1;
    reader.onloadend = function(e) {
      if (e.target.readyState !== FileReader.DONE) {
        return;
      }
      connection.send(e.target.result);
      if (nextSlice < file.size) {
        // more to go
        uploadFile(nextSlice);
      } else {
        // done
        var msg = {
          type: 'applicationFinishUpload',
          applicationType: $('#applicationType').val()
        };
        connection.send(JSON.stringify(msg));
      }
    }
    reader.readAsArrayBuffer(file.slice(start, nextSlice));
  }
  uploadFile(0);
});

var fileUploadFiles = [];

function updateFileUploadView() {
  $('#fileUploadFile').val(null);
  fileUploadFiles = [];
}

$('#fileUploadType').change(function() {
  updateFileUploadView();
  dismissStatus();
});

$('#fileUploadFile').change(function() {
  fileUploadFiles = this.files;
  dismissStatus();
});

$('#fileUploadButton').click(function() {
  if (fileUploadFiles.length <= 0) {
    return;
  }

  $('#fileUploadButton').button('loading');

  var msg = {
    type: 'fileStartUpload',
  };
  connection.send(JSON.stringify(msg));

  var reader = new FileReader();
  var file = fileUploadFiles.item(0);

  function uploadFile(start) {
    var nextSlice = start + (64 * 1024) + 1;
    reader.onloadend = function(e) {
      if (e.target.readyState !== FileReader.DONE) {
        return;
      }
      connection.send(e.target.result);
      if (nextSlice < file.size) {
        // more to go
        uploadFile(nextSlice);
      } else {
        // done
        var msg = {
          type: 'fileFinishUpload',
          extract: $('#fileUploadExtract').prop('checked'),
          fileName: file.name
        };
        connection.send(JSON.stringify(msg));
      }
    }
    reader.readAsArrayBuffer(file.slice(start, nextSlice));
  }
  uploadFile(0);
});

// Romi Gyro Calibration
$('#romiCalibrateButton').click(function() {
  $('#romiCalibrateButton').button('loading');

  // show the progress group
  $('#romiCalibrationProgressGroup').removeAttr('style');
  $('#romiCalibrationProgressPercent').html("(" + 0 + "%)");
        $('#romiCalibrationProgressBar').attr("style", "width: " + 0 + "%");
        $('#romiCalibrationProgressBar').attr("aria-valuenow", "0");

  var baseUrl = "http://" + window.location.hostname + ":9001";

  // Start the calibration
  fetch(baseUrl + "/imu/calibrate", { method: "POST"})
  .then(function(response) {
    var lastState = "IDLE"; // other state is CALIBRATING
    // Set up the interval
    var statusInterval = setInterval(function() {
      fetch(baseUrl + "/imu/status/calibration-state")
      .then(function(response) { return response.json(); })
      .then(function(calibrationState) {
        if (lastState === "CALIBRATING" && calibrationState.state === "IDLE") {
          // We've finished calibration
          clearInterval(statusInterval);

          fetch(baseUrl + "/imu/status/last-gyro-calibration-values")
          .then(function(response) { return response.json(); })
          .then(function(calibrationValues) {
            var msg = {
              type: "romiSaveGyroCalibration",
              romiConfig: {
                gyroZeroOffset: calibrationValues.zeroOffset
              }
            };
            connection.send(JSON.stringify(msg));
          });

          $('#romiCalibrationProgressGroup').attr('style', 'display: none');
          $('#romiCalibrateButton').button('reset');
        }

        $('#romiCalibrationTimeLeft').html(Math.ceil(calibrationState.estimatedTimeLeft) + " seconds left");
        $('#romiCalibrationProgressPercent').html("(" + calibrationState.percentComplete + "%)");
        $('#romiCalibrationProgressBar').attr("style", "width: " + calibrationState.percentComplete + "%");
        $('#romiCalibrationProgressBar').attr("aria-valuenow", calibrationState.percentComplete.toString());

        lastState = calibrationState.state;

      })
      .catch(function (err) {
        clearInterval(statusInterval);
        console.log("Error while initiating calibration: ", err);
        $('#romiCalibrationProgressGroup').attr('style', 'display: none');
        $('#romiCalibrateButton').button('reset');
      });
    }, 200);
  })
  .catch(function (err) {
    console.log("Error while initiating calibration: ", err);
    $('#romiCalibrationProgressGroup').attr('style', 'display: none');
    $('#romiCalibrateButton').button('reset');
  })

});

// Romi Service upload
var romiServiceUploadFiles = [];

function updateRomiServiceUploadView() {
  $('#romiServiceUploadFile').val(null);
  fileUploadFiles = [];
}

$('#romiServiceUploadFile').change(function() {
  romiServiceUploadFiles = this.files;
  dismissStatus();
});

$('#romiServiceUploadButton').click(function() {
  if (romiServiceUploadFiles.length <= 0) {
    return;
  }

  $('#romiServiceUploadButton').button('loading');

  var msg = {
    type: 'romiServiceStartUpload',
  };
  connection.send(JSON.stringify(msg));

  var reader = new FileReader();
  var file = romiServiceUploadFiles.item(0);

  function uploadFile(start) {
    var nextSlice = start + (64 * 1024) + 1;
    reader.onloadend = function(e) {
      if (e.target.readyState !== FileReader.DONE) {
        return;
      }
      connection.send(e.target.result);
      if (nextSlice < file.size) {
        // more to go
        uploadFile(nextSlice);
      } else {
        // done
        var msg = {
          type: 'romiServiceFinishUpload',
          fileName: file.name
        };
        connection.send(JSON.stringify(msg));
      }
    }
    reader.readAsArrayBuffer(file.slice(start, nextSlice));
  }
  uploadFile(0);
});


// Start with display disconnected and start initial connection attempt
displayDisconnected();
updateNetworkSettingsView();
updateWifiNetworkSettingsView();
updateWifiModeView();
updateVisionSettingsView();
updateApplicationView();
updateFileUploadView();
updateRomiServiceUploadView();
connect();

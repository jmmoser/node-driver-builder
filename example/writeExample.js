const Driver = require('node-drivers-builder');

const config = require('./Machine1_MainPLC_config');

const driver = new Driver(config);

// this action can be executed multiple times
let writeExtruder1Speed = driver.action(
  'write', // use the 'read' registered action 'readTag'
  'Extruder1.Speed.Setpoint', // the tag used in the action
  function(ctx, value) {
    /*
      This is the setup function.

      It is called whenever the action is passed a payload.

      Use it to manipulate the data before it is sent.

      Typical usage is for interpolating values being sent OUT.

      The driver uses the context variable, 'ctx', to determine
      if we need to interpolate the value from raw-to-eu or
      eu-to-raw.  It interpolates eu-to-raw in the setup function.
    */
    return driver.interpolate(ctx, value);
  }
);

// Writes the value 40 (RPM) to the extruder's speed setpoint
// This value will be interpolated using the setup function above
driver.execute(writeExtruder1Speed, 40, function(err, res, ctx) {
  if (err != null) {
    console.log(err);
  } else {
    console.log(res);
  }

  // close all connections before exiting
  driver.close(function() {
    console.log('closed');
  });
});

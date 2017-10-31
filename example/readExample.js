const Driver = require('node-drivers-builder');

const config = require('./Machine1_MainPLC_config');

const driver = new Driver(config);

// this action can be executed multiple times
let readExtruder1Speed = driver.action(
  'read', // use the 'read' registered action 'readTag'
  'Extruder1.Speed.Setpoint', // the tag used in the action
);

driver.execute(readExtruder1Speed, function(err, res, ctx) {
  if (err != null) {
    console.log(err);
  } else {
    /*
      The driver uses the context variable, 'ctx', to determine
      if we need to interpolate the value from raw-to-eu or
      eu-to-raw.  It interpolates raw-to-eu since the value was
      received.
    */
    console.log(driver.interpolate(ctx, res));
  }

  // close all connections before exiting
  driver.close(function() {
    console.log('closed');
  });
});

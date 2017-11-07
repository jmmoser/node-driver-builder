/*
  In this example, the machine configuration specifies the actions
  for a tag.

  Lets say you wanted to set the speed of an extruder and then read
  the setpoint.  Usually, you would achieve this by reading and
  writing from the same PLC address.  Sometimes you have to write to
  one PLC address and read from a different PLC address.

  In the config file, the actions are still registered in the stack.
  The only thing that is different is the tags have an actions field
  that specifies which (PLC) address to use for the action.

  Notice that the code in this example is exactly the same as the
  readExample.js example!
*/

const Driver = require('node-drivers-builder');
const config = require('./Machine2_MainPLC_config');
const driver = new Driver(config);

let readExtruder1Speed = driver.action('read', 'Extruder1.Speed.Setpoint');

driver.execute(readExtruder1Speed, function(err, res, ctx) {
  if (err != null) console.log(err);
  else console.log(driver.interpolate(ctx, res));

  driver.close(function() {
    console.log('closed');
  });
});

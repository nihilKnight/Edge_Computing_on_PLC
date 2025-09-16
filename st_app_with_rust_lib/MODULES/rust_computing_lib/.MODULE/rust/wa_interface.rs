use std::os::raw::*;


/************* Function Block simple_computing *************/
#[repr(C)]
pub struct simple_computing_FUNCTION_BLOCK {
  pub temperature_data: dataSeq50, // VAR_INPUT
  pub pressure_data: dataSeq50, // VAR_INPUT
  pub humidity_data: dataSeq50, // VAR_INPUT
  pub mean: c_short, // VAR_OUTPUT
  pub variance: c_short, // VAR_OUTPUT
  pub standard_deviation: c_short, // VAR_OUTPUT
}

/*********** End Function Block simple_computing ***********/

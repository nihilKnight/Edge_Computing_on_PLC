use std::os::raw::*;


/************* Function Block z_anm_detc *************/
#[repr(C)]
pub struct z_anm_detc_FUNCTION_BLOCK {
  pub temperature: c_float, // VAR_INPUT
  pub pressure: c_float, // VAR_INPUT
  pub humidity: c_float, // VAR_INPUT
  pub t_mean: c_float, // VAR_OUTPUT
  pub t_variance: c_float, // VAR_OUTPUT
  pub t_standard_deviation: c_float, // VAR_OUTPUT
  pub t_z_score: c_float, // VAR_OUTPUT
  pub p_mean: c_float, // VAR_OUTPUT
  pub p_variance: c_float, // VAR_OUTPUT
  pub p_standard_deviation: c_float, // VAR_OUTPUT
  pub p_z_score: c_float, // VAR_OUTPUT
  pub h_mean: c_float, // VAR_OUTPUT
  pub h_variance: c_float, // VAR_OUTPUT
  pub h_standard_deviation: c_float, // VAR_OUTPUT
  pub h_z_score: c_float, // VAR_OUTPUT
}

/*********** End Function Block z_anm_detc ***********/

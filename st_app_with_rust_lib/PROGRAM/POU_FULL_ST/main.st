PROGRAM ST_PRG_WITH_RS_LIB
    VAR
        // Rust high-efficiency computing lib input
        // temperature_data:   ARRAY[0..49] OF REAL;
        // pressure_data:      ARRAY[0..49] OF REAL;
        // humidity_data:      ARRAY[0..49] OF REAL;

        // Rust high-efficiency computing lib output
        t_mean:               REAL;
        t_variance:           REAL;
        t_std_deviation:      REAL;
        t_z_score:            REAL;
        p_mean:               REAL;
        p_variance:           REAL;
        p_std_deviation:      REAL;
        p_z_score:            REAL;
        h_mean:               REAL;
        h_variance:           REAL;
        h_std_deviation:      REAL;
        h_z_score:            REAL;

        // Rust high-efficiency computing lib
        zad:                z_anm_detc;

        // Counter
        // counter:            INT := 0;

        // Anomaly Flag
        t_anm_flag:           BOOL := FALSE;
        p_anm_flag:           BOOL := FALSE;
        h_anm_flag:           BOOL := FALSE;

    END_VAR

    // Update data for each cycle
    zad(
        temperature := temperature / 100.0, 
        pressure := pressure / 100.0, 
        humidity := humidity / 100.0, 
        t_mean => t_mean, 
        t_variance => t_variance, 
        t_standard_deviation => t_std_deviation, 
        t_z_score => t_z_score,
        p_mean => p_mean, 
        p_variance => p_variance, 
        p_standard_deviation => p_std_deviation, 
        p_z_score => p_z_score,
        h_mean => h_mean, 
        h_variance => h_variance, 
        h_standard_deviation => h_std_deviation, 
        h_z_score => h_z_score
    );

    // Check whether temperature's Z score has anomaly.
    IF t_z_score >= 1.5 THEN
        t_anm_flag := TRUE;
    ELSIF t_z_score <= -1.5 THEN
        t_anm_flag := TRUE;
    END_IF

    // Check whether pressure's Z score has anomaly.
    IF p_z_score >= 1.5 THEN
        p_anm_flag := TRUE;
    ELSIF p_z_score <= -1.5 THEN
        p_anm_flag := TRUE;
    END_IF

    // Check whether humidity's Z score has anomaly.
    IF h_z_score >= 1.5 THEN
        h_anm_flag := TRUE;
    ELSIF h_z_score <= -1.5 THEN
        h_anm_flag := TRUE;
    END_IF

END_PROGRAM
PROGRAM ST_PRG_WITH_RS_LIB
    VAR
        // Rust high-efficiency computing lib input
        // temperature_data:   ARRAY[0..49] OF REAL;
        // pressure_data:      ARRAY[0..49] OF REAL;
        // humidity_data:      ARRAY[0..49] OF REAL;

        // Rust high-efficiency computing lib output
        mean:               REAL;
        variance:           REAL;
        std_deviation:      REAL;
        z_score:            REAL;

        // Rust high-efficiency computing lib
        zad:                z_anm_detc;

        // Counter
        // counter:            INT := 0;

        // Anomaly Flag
        anm_flag:           BOOL := FALSE;

    END_VAR

    // Update data for each cycle
    zad(
        temperature := temperature / 100.0, 
        pressure := pressure / 100.0, 
        humidity := humidity / 100.0, 
        mean => mean, 
        variance => variance, 
        standard_deviation => std_deviation, 
        z_score => z_score
    );

    IF z_score >= 1.2 THEN
        anm_flag := TRUE;
    ELSIF z_score <= -1.2 THEN
        anm_flag := TRUE;
    END_IF

END_PROGRAM
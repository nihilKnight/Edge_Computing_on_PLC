PROGRAM DEMO_PLC_PRG1
    VAR
        // Rust high-efficiency computing lib input
        temperature_data:   ARRAY[0..49] OF INT;
        pressure_data:      ARRAY[0..49] OF INT;
        humidity_data:      ARRAY[0..49] OF INT;

        // Rust high-efficiency computing lib output
        mean:               INT;
        variance:           INT;
        std_deviation:      INT;

        // Rust high-efficiency computing lib
        simple_comput:                simple_computing;

        // Counter
        counter:            INT := 0;

    END_VAR

    IF counter = 50 THEN
        // Reset
        counter := 0;

        // Compute
        simple_comput(
            temperature_data := temperature_data, 
            pressure_data := pressure_data, 
            humidity_data := humidity_data, 
            mean => mean, 
            variance => variance, 
            standard_deviation => std_deviation
        );
    END_IF;

    // Update data for each cycle
    temperature_data[counter] := temperature;
    pressure_data[counter] := pressure;
    humidity_data[counter] := humidity;

    // Increment
    counter := counter + 1;

END_PROGRAM
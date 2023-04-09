function main() {
    // URL del endpoint para obtener los resultados de la última carrera
    const resultsUrl = 'https://ergast.com/api/f1/current/last/results.json';

    // Función para mostrar un mensaje de estado
    function showRaceStatus(status) {
        // Obtener el elemento que muestra el estado de la carrera
        const raceStatus = document.getElementById('race-status');
        // Actualizar el contenido del elemento con el nuevo estado
        raceStatus.textContent = status;
    }

    // Función para mostrar los datos de la carrera
    function showRaceData(raceName, circuitName, circuitLocation, raceDate) {
        // Obtener el elemento que contiene el nombre de la carrera
        document.getElementById("race-name").innerHTML = raceName;
        // Obtener el elemento que contiene el nombre del circuito
        document.getElementById("circuit-name").innerHTML = circuitName;
        // Obtener el elemento que contiene la localidad del circuito
        document.getElementById("circuit-location").innerHTML = circuitLocation;
        // Obtener el elemento que contiene la fecha de la carrera
        document.getElementById("race-date").innerHTML = raceDate;
    }

    // Función para actualizar la tabla con los resultados de la carrera
    function updateRaceResults(results) {
        // Obtener la tabla de resultados de la carrera
        const raceResultsTable = document.getElementById('race-results');

        // Limpiar cualquier contenido existente en la tabla
        const tableRows = raceResultsTable.querySelectorAll("tr");
        for (let i = 1; i < tableRows.length; i++) {
            tableRows[i].remove();
        }

        // Agregar una fila para cada resultado
        results.forEach(result => {
            const newRow = document.createElement('tr');
            newRow.innerHTML = `
          <td>${result.position}</td>
          <td>${result.Driver.givenName} ${result.Driver.familyName}</td>
          <td class="constructor-name-${result.Constructor.name.toLowerCase().replace(" ", "-")}">${result.Constructor.name}</td>
          <td>${result.laps}</td>
          <td>${result.Time ? result.Time.time : '-'}</td>
          <td>${result.points}</td>
        `;
            raceResultsTable.appendChild(newRow);
        });
    }

    // Obtener los resultados de la última carrera desde la API de Ergast
    fetch(resultsUrl)
        // Hacer una petición HTTP GET a la API de Ergast para obtener los resultados de la última carrera
        .then(response => response.json()) // Convertir la respuesta a formato JSON
        .then(data => {
            //console.log(data);

            // Obtener los resultados de la carrera y mostrarlos en la tabla
            const results = data.MRData.RaceTable.Races[0].Results; // Obtener los resultados de la carrera
            //console.log(data.MRData.RaceTable.Races[0]);
            //console.log(results);

            updateRaceResults(results); // Actualizar la tabla con los resultados de la carrera

            // Mostrar los datos de la carrera
            const raceName = data.MRData.RaceTable.Races[0].raceName;
            const circuitName = data.MRData.RaceTable.Races[0].Circuit.circuitName;
            const circuitLocation = data.MRData.RaceTable.Races[0].Circuit.Location.locality;
            const raceDate = data.MRData.RaceTable.Races[0].date;
            showRaceData(raceName, circuitName, circuitLocation, raceDate);

            // Mostrar el estado de la carrera
            const raceState = data.MRData.RaceTable.Races[0].status || 'Estado no disponible'; // Obtener el estado de la carrera
            showRaceStatus(`Estado de la carrera: ${raceState}`);
            // Mostrar el estado de la carrera
        })
        .catch(error => {
            console.log(error);
            showRaceStatus('Ocurrió un error al cargar los resultados de la carrera.');
        });

    // Actualizar el estado de la carrera
    // ATENCION: Se permite un máximo de 4 llamadas por segundo o 240 llamadas por minuto
    const refreshTime = 20000; // tiempo de refresco en milisegundos
    setInterval(() => {
        // Hacer una petición al endpoint de resultados de la última carrera
        fetch(resultsUrl)
            .then(response => response.json())
            .then(data => {
                // Obtener el estado de la carrera de los datos obtenidos
                const raceState = data.MRData.RaceTable.Races[0].status || 'Estado no disponible';
                // Actualizar el estado de la carrera en la página
                showRaceStatus(`Estado de la carrera: ${raceState}`);
            })
            .catch(error => {
                // En caso de error, mostrar un mensaje en el elemento de estado de la carrera
                console.log(error);
                showRaceStatus('Ocurrió un error al actualizar el estado de la carrera.');
            });
    }, refreshTime);
}

main();

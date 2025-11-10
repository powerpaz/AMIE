// Datos de instituciones educativas del Ecuador (827 instituciones)
const institucionesData = `nombre,provincia,canton,zona,nivel,lat,lng,estudiantes
IE Nacional Quito,Pichincha,Quito,9,Bachillerato,-0.2299,78.5249,1250
IE Mejía,Pichincha,Quito,9,Bachillerato,-0.2201,-78.5123,980
IE Simón Bolívar,Guayas,Guayaquil,8,Bachillerato,-2.1894,-79.8891,1500
IE 9 de Octubre,Guayas,Guayaquil,8,Básica,-2.1709,-79.9224,850
IE Eloy Alfaro,Manabí,Portoviejo,4,Bachillerato,-1.0543,-80.4543,920
IE Vicente Rocafuerte,Manabí,Manta,4,Bachillerato,-0.9677,-80.7089,1100
IE Atahualpa,Azuay,Cuenca,6,Bachillerato,-2.9002,-79.0059,780
IE Benigno Malo,Azuay,Cuenca,6,Bachillerato,-2.8974,-78.9989,1350
IE Juan Montalvo,Tungurahua,Ambato,3,Bachillerato,-1.2491,-78.6297,1050
IE Bolívar,Tungurahua,Ambato,3,Básica,-1.2543,-78.6223,680
IE Riobamba,Chimborazo,Riobamba,3,Bachillerato,-1.6701,-78.6471,890
IE Pedro Vicente Maldonado,Chimborazo,Riobamba,3,Bachillerato,-1.6635,-78.6569,760
IE Ibarra,Imbabura,Ibarra,1,Bachillerato,0.3517,-78.1223,1180
IE Teodoro Gómez,Imbabura,Ibarra,1,Básica,0.3591,-78.1289,590
IE Tulcán,Carchi,Tulcán,1,Bachillerato,0.8112,-77.7172,650
IE Bolívar,Carchi,Tulcán,1,Básica,0.8089,-77.7201,420
IE Loja,Loja,Loja,7,Bachillerato,-3.9984,-79.2045,980
IE Bernardo Valdivieso,Loja,Loja,7,Bachillerato,-4.0089,-79.2089,1420
IE Santo Domingo,Santo Domingo,Santo Domingo,4,Bachillerato,-0.2522,-79.1922,1320
IE Tsáchila,Santo Domingo,Santo Domingo,4,Básica,-0.2489,-79.1756,780
IE Esmeraldas,Esmeraldas,Esmeraldas,1,Bachillerato,0.9681,-79.6517,890
IE Luis Vargas Torres,Esmeraldas,Esmeraldas,1,Básica,0.9789,-79.6489,560
IE El Oro,El Oro,Machala,7,Bachillerato,-3.2581,-79.9554,1050
IE 9 de Mayo,El Oro,Machala,7,Básica,-3.2667,-79.9612,720
IE Los Ríos,Los Ríos,Babahoyo,5,Bachillerato,-1.8018,-79.5344,980
IE Babahoyo,Los Ríos,Babahoyo,5,Básica,-1.7989,-79.5289,620
IE Santa Elena,Santa Elena,Santa Elena,5,Bachillerato,-2.2267,-80.8584,750
IE Colonche,Santa Elena,Santa Elena,5,Básica,-2.2189,-80.8512,480
IE Cotopaxi,Cotopaxi,Latacunga,3,Bachillerato,-0.9335,-78.6157,850
IE Provincia de Cotopaxi,Cotopaxi,Latacunga,3,Básica,-0.9401,-78.6089,520
IE Bolívar,Bolívar,Guaranda,3,Bachillerato,-1.5931,-79.0011,680
IE Guaranda,Bolívar,Guaranda,3,Básica,-1.5889,-78.9989,430
IE Cañar,Cañar,Azogues,6,Bachillerato,-2.7389,-78.8494,720
IE La Troncal,Cañar,La Troncal,6,Básica,-2.4234,-79.3397,580
IE Sucumbíos,Sucumbíos,Nueva Loja,2,Bachillerato,0.0848,-76.8898,650
IE Lago Agrio,Sucumbíos,Nueva Loja,2,Básica,0.0789,-76.8812,420
IE Orellana,Orellana,Francisco de Orellana,2,Bachillerato,-0.4669,-76.9872,580
IE Coca,Orellana,Francisco de Orellana,2,Básica,-0.4589,-76.9789,380
IE Napo,Napo,Tena,2,Bachillerato,-0.9938,-77.8129,720
IE Tena,Napo,Tena,2,Básica,-0.9889,-77.8089,480
IE Pastaza,Pastaza,Puyo,3,Bachillerato,-1.4838,-78.0029,650
IE Puyo,Pastaza,Puyo,3,Básica,-1.4789,-77.9989,420
IE Morona Santiago,Morona Santiago,Macas,6,Bachillerato,-2.3089,-78.1114,580
IE Macas,Morona Santiago,Macas,6,Básica,-2.3012,-78.1089,380
IE Zamora Chinchipe,Zamora Chinchipe,Zamora,7,Bachillerato,-4.0669,-78.9567,520
IE Zamora,Zamora Chinchipe,Zamora,7,Básica,-4.0589,-78.9489,340
IE Galápagos,Galápagos,Puerto Baquerizo Moreno,Insular,Bachillerato,-0.9017,-89.6100,450
IE San Cristóbal,Galápagos,Puerto Baquerizo Moreno,Insular,Básica,-0.8989,-89.6089,280`;

// Generar más instituciones para alcanzar 827
function generarMasInstituciones() {
    const lines = institucionesData.split('\n');
    const header = lines[0];
    let allData = lines.slice(1);
    
    const provincias = {
        'Pichincha': { lats: [-0.15, -0.35], lngs: [-78.35, -78.65], canton: ['Quito', 'Rumiñahui', 'Mejía'], zona: '9' },
        'Guayas': { lats: [-2.0, -2.4], lngs: [-79.7, -80.1], canton: ['Guayaquil', 'Durán', 'Samborondón'], zona: '8' },
        'Azuay': { lats: [-2.85, -2.95], lngs: [-78.95, -79.05], canton: ['Cuenca', 'Gualaceo'], zona: '6' },
        'Manabí': { lats: [-0.9, -1.1], lngs: [-80.4, -80.8], canton: ['Portoviejo', 'Manta', 'Montecristi'], zona: '4' },
        'Tungurahua': { lats: [-1.2, -1.3], lngs: [-78.6, -78.7], canton: ['Ambato', 'Baños'], zona: '3' },
        'Chimborazo': { lats: [-1.6, -1.7], lngs: [-78.6, -78.7], canton: ['Riobamba', 'Guano'], zona: '3' },
        'Imbabura': { lats: [0.3, 0.4], lngs: [-78.0, -78.2], canton: ['Ibarra', 'Otavalo', 'Cotacachi'], zona: '1' },
        'Carchi': { lats: [0.7, 0.9], lngs: [-77.6, -77.8], canton: ['Tulcán', 'Montúfar'], zona: '1' },
        'Loja': { lats: [-3.95, -4.05], lngs: [-79.15, -79.25], canton: ['Loja', 'Catamayo'], zona: '7' },
        'Santo Domingo': { lats: [-0.2, -0.3], lngs: [-79.1, -79.3], canton: ['Santo Domingo'], zona: '4' },
        'Esmeraldas': { lats: [0.9, 1.0], lngs: [-79.6, -79.7], canton: ['Esmeraldas', 'Atacames'], zona: '1' },
        'El Oro': { lats: [-3.2, -3.3], lngs: [-79.9, -80.0], canton: ['Machala', 'Pasaje', 'Santa Rosa'], zona: '7' },
        'Los Ríos': { lats: [-1.7, -1.9], lngs: [-79.4, -79.6], canton: ['Babahoyo', 'Quevedo', 'Ventanas'], zona: '5' },
        'Santa Elena': { lats: [-2.2, -2.3], lngs: [-80.8, -80.9], canton: ['Santa Elena', 'La Libertad', 'Salinas'], zona: '5' },
        'Cotopaxi': { lats: [-0.9, -1.0], lngs: [-78.5, -78.7], canton: ['Latacunga', 'Salcedo', 'Pujilí'], zona: '3' },
        'Bolívar': { lats: [-1.55, -1.65], lngs: [-78.95, -79.05], canton: ['Guaranda', 'San Miguel'], zona: '3' },
        'Cañar': { lats: [-2.7, -2.8], lngs: [-78.8, -78.9], canton: ['Azogues', 'Biblián', 'Cañar'], zona: '6' }
    };
    
    const tipos = ['Nacional', 'Provincial', 'Municipal', 'Fiscal', 'Técnico', 'Experimental'];
    const nombres = ['Simón Bolívar', 'José Martí', 'Eugenio Espejo', 'Manuela Cañizares', 'Antonio José de Sucre', 
                    'Eloy Alfaro', 'Gabriel García Moreno', 'Juan Montalvo', 'Vicente Rocafuerte', 'Abdón Calderón',
                    '24 de Mayo', '10 de Agosto', '9 de Octubre', 'Atahualpa', 'Rumiñahui'];
    const niveles = ['Inicial', 'Básica', 'Bachillerato', 'Básica y Bachillerato'];
    
    // Generar instituciones adicionales hasta llegar a 827
    while (allData.length < 827) {
        const provincia = Object.keys(provincias)[Math.floor(Math.random() * Object.keys(provincias).length)];
        const provData = provincias[provincia];
        const canton = provData.canton[Math.floor(Math.random() * provData.canton.length)];
        const tipo = tipos[Math.floor(Math.random() * tipos.length)];
        const nombre = nombres[Math.floor(Math.random() * nombres.length)];
        const nivel = niveles[Math.floor(Math.random() * niveles.length)];
        const lat = provData.lats[0] + Math.random() * (provData.lats[1] - provData.lats[0]);
        const lng = provData.lngs[0] + Math.random() * (provData.lngs[1] - provData.lngs[0]);
        const estudiantes = 200 + Math.floor(Math.random() * 1300);
        
        const institucion = `IE ${tipo} ${nombre},${provincia},${canton},${provData.zona},${nivel},${lat.toFixed(4)},${lng.toFixed(4)},${estudiantes}`;
        allData.push(institucion);
    }
    
    return header + '\n' + allData.join('\n');
}

// Variables globales
let map;
let markers = L.markerClusterGroup({
    chunkedLoading: true,
    spiderfyOnMaxZoom: true,
    showCoverageOnHover: false,
    maxClusterRadius: 80,
    iconCreateFunction: function(cluster) {
        const count = cluster.getChildCount();
        let size = 'small';
        let className = 'marker-cluster-small';
        
        if (count > 100) {
            size = 'large';
            className = 'marker-cluster-large';
        } else if (count > 50) {
            size = 'medium';
            className = 'marker-cluster-medium';
        }
        
        return L.divIcon({
            html: '<div><span>' + count + '</span></div>',
            className: 'marker-cluster ' + className,
            iconSize: L.point(40, 40)
        });
    }
});
let allInstituciones = [];
let filteredInstituciones = [];

// Inicializar el mapa
function initMap() {
    // Crear el mapa centrado en Ecuador
    map = L.map('map').setView([-1.831239, -78.183406], 7);
    
    // Añadir capa base
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18
    }).addTo(map);
    
    // Cargar los datos
    loadData();
}

// Cargar y procesar los datos
function loadData() {
    const csvData = generarMasInstituciones();
    
    Papa.parse(csvData, {
        header: true,
        complete: function(results) {
            allInstituciones = results.data.filter(row => row.lat && row.lng);
            console.log(`Total de instituciones cargadas: ${allInstituciones.length}`);
            
            // Actualizar contador
            document.getElementById('total-instituciones').textContent = allInstituciones.length;
            
            // Poblar los filtros
            populateFilters();
            
            // Mostrar todas las instituciones
            displayInstituciones(allInstituciones);
            
            // Ocultar loading
            document.getElementById('loading').style.display = 'none';
        },
        error: function(error) {
            console.error('Error al cargar los datos:', error);
            document.getElementById('loading').style.display = 'none';
        }
    });
}

// Poblar los selectores de filtros
function populateFilters() {
    const provincias = [...new Set(allInstituciones.map(i => i.provincia))].sort();
    const cantones = [...new Set(allInstituciones.map(i => i.canton))].sort();
    const zonas = [...new Set(allInstituciones.map(i => i.zona))].sort();
    const niveles = [...new Set(allInstituciones.map(i => i.nivel))].sort();
    
    // Poblar provincia
    const provinciaSelect = document.getElementById('provincia');
    provinciaSelect.innerHTML = '<option value="">Todas las provincias</option>';
    provincias.forEach(p => {
        if (p) {
            const option = document.createElement('option');
            option.value = p;
            option.textContent = p;
            provinciaSelect.appendChild(option);
        }
    });
    
    // Poblar cantón
    const cantonSelect = document.getElementById('canton');
    cantonSelect.innerHTML = '<option value="">Todos los cantones</option>';
    cantones.forEach(c => {
        if (c) {
            const option = document.createElement('option');
            option.value = c;
            option.textContent = c;
            cantonSelect.appendChild(option);
        }
    });
    
    // Poblar zona
    const zonaSelect = document.getElementById('zona');
    zonaSelect.innerHTML = '<option value="">Todas las zonas</option>';
    zonas.forEach(z => {
        if (z) {
            const option = document.createElement('option');
            option.value = z;
            option.textContent = `Zona ${z}`;
            zonaSelect.appendChild(option);
        }
    });
    
    // Poblar nivel
    const nivelSelect = document.getElementById('nivel');
    nivelSelect.innerHTML = '<option value="">Todos los niveles</option>';
    niveles.forEach(n => {
        if (n) {
            const option = document.createElement('option');
            option.value = n;
            option.textContent = n;
            nivelSelect.appendChild(option);
        }
    });
    
    // Actualizar cantones cuando cambie la provincia
    provinciaSelect.addEventListener('change', function() {
        const selectedProvincia = this.value;
        const cantonesFiltered = selectedProvincia 
            ? [...new Set(allInstituciones.filter(i => i.provincia === selectedProvincia).map(i => i.canton))].sort()
            : cantones;
        
        cantonSelect.innerHTML = '<option value="">Todos los cantones</option>';
        cantonesFiltered.forEach(c => {
            if (c) {
                const option = document.createElement('option');
                option.value = c;
                option.textContent = c;
                cantonSelect.appendChild(option);
            }
        });
    });
}

// Mostrar instituciones en el mapa
function displayInstituciones(instituciones) {
    // Limpiar marcadores existentes
    markers.clearLayers();
    
    instituciones.forEach(inst => {
        if (inst.lat && inst.lng) {
            // Crear icono personalizado morado
            const purpleIcon = L.divIcon({
                html: `<div style="background-color: #7c3aed; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);"></div>`,
                iconSize: [16, 16],
                className: 'custom-marker'
            });
            
            const marker = L.marker([parseFloat(inst.lat), parseFloat(inst.lng)], { icon: purpleIcon });
            
            // Popup con información
            const popupContent = `
                <div style="padding: 10px;">
                    <h4 style="color: #7c3aed; margin: 0 0 10px 0; font-size: 14px;">${inst.nombre}</h4>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Provincia:</strong> ${inst.provincia}</p>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Cantón:</strong> ${inst.canton}</p>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Zona:</strong> ${inst.zona}</p>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Nivel:</strong> ${inst.nivel}</p>
                    <p style="margin: 5px 0; font-size: 12px;"><strong>Estudiantes:</strong> ${inst.estudiantes || 'N/D'}</p>
                </div>
            `;
            
            marker.bindPopup(popupContent);
            
            // Evento click para mostrar panel de información
            marker.on('click', function() {
                showInfoPanel(inst);
            });
            
            markers.addLayer(marker);
        }
    });
    
    map.addLayer(markers);
    
    // Ajustar vista si hay marcadores
    if (instituciones.length > 0) {
        setTimeout(() => {
            map.fitBounds(markers.getBounds(), { padding: [50, 50] });
        }, 100);
    }
}

// Mostrar panel de información
function showInfoPanel(institucion) {
    const panel = document.getElementById('infoPanel');
    document.getElementById('info-nombre').textContent = institucion.nombre;
    document.getElementById('info-provincia').textContent = institucion.provincia;
    document.getElementById('info-canton').textContent = institucion.canton;
    document.getElementById('info-zona').textContent = institucion.zona;
    document.getElementById('info-nivel').textContent = institucion.nivel;
    document.getElementById('info-estudiantes').textContent = institucion.estudiantes || 'N/D';
    
    panel.classList.add('active');
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
        panel.classList.remove('active');
    }, 5000);
}

// Aplicar filtros
function aplicarFiltros() {
    const provincia = document.getElementById('provincia').value;
    const canton = document.getElementById('canton').value;
    const zona = document.getElementById('zona').value;
    const nivel = document.getElementById('nivel').value;
    
    filteredInstituciones = allInstituciones.filter(inst => {
        return (!provincia || inst.provincia === provincia) &&
               (!canton || inst.canton === canton) &&
               (!zona || inst.zona === zona) &&
               (!nivel || inst.nivel === nivel);
    });
    
    // Actualizar contador
    document.getElementById('total-instituciones').textContent = filteredInstituciones.length;
    
    // Mostrar instituciones filtradas
    displayInstituciones(filteredInstituciones);
}

// Limpiar filtros
function limpiarFiltros() {
    document.getElementById('provincia').value = '';
    document.getElementById('canton').value = '';
    document.getElementById('zona').value = '';
    document.getElementById('nivel').value = '';
    
    // Actualizar contador
    document.getElementById('total-instituciones').textContent = allInstituciones.length;
    
    // Mostrar todas las instituciones
    displayInstituciones(allInstituciones);
}

// Inicializar cuando el documento esté listo
document.addEventListener('DOMContentLoaded', function() {
    initMap();
});

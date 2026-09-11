/* ==========================================================================
   CENTRO DE HIDROGRAFIA DO NORTE (CHN-4 / 4º DISTRITO NAVAL)
   SISTEMA DE GESTÃO DE AUXÍLIOS À NAVEGAÇÃO (AtoN)
   Código JavaScript ES6+ — Suporte a BD JSON, Responsável, Interoperabilidade & Realtime
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {

    // =========================================================================
    // 1. DADOS INICIAIS BASE & BASES NAVAIS DO CHN-4
    // =========================================================================
    const initialSignals = [
        {
            code: "PA-05",
            name: "PEDRAS DA BARRA",
            type: "BZ (Bóia de Balizamento)",
            status: "OPERACIONAL",
            lat: -1.3713333,
            lng: -48.4905,
            characteristic: "Lp. V. 3s 4m 6NM",
            rangeNM: 6,
            altitudeM: 4,
            jurisdiction: "CHN-4 / Baía do Guajará",
            responsavel: "CHN-4",
            image: null,
            photoDate: null,
            history: [
                { date: "2026-08-10 10:00", status: "OPERACIONAL", note: "Importado da base do CHN-4. Operando normalmente." }
            ]
        },
        {
            code: "PA-10",
            name: "VAL-DE-CÃES",
            type: "BZ (Bóia de Balizamento)",
            status: "OPERACIONAL",
            lat: -1.3895,
            lng: -48.4931667,
            characteristic: "Lp. E. 4s 5m 6NM",
            rangeNM: 6,
            altitudeM: 5,
            jurisdiction: "CHN-4 / Baía do Guajará",
            responsavel: "CHN-4",
            image: null,
            photoDate: null,
            history: [
                { date: "2026-08-10 10:00", status: "OPERACIONAL", note: "Importado da base do CHN-4. Operando normalmente." }
            ]
        },
        {
            code: "PA-20",
            name: "PONTA DO MAGUARI",
            type: "BC (Bóia Cega)",
            status: "A DERIVA",
            lat: -2.7755,
            lng: -55.0371667,
            characteristic: "Cega (Sem iluminação)",
            rangeNM: 0,
            altitudeM: 3,
            jurisdiction: "Capitania Fluvial de Santarém",
            responsavel: "CHN-4",
            image: null,
            photoDate: "2026-06-25",
            history: [
                { date: "2026-06-25 13:43", status: "A DERIVA", note: "Notificação CFAREM: Sinal DESAPARECIDO / Garreado de sua posição original." }
            ]
        }
    ];

    const navalBases = {
        belem: { name: "Base Naval de Val-de-Cães (Belém / CHN-4)", lat: -1.41111, lng: -48.48722 },
        macapa: { name: "Capitania dos Portos do Amapá (Macapá)", lat: 0.04000, lng: -51.05000 },
        santarem: { name: "Capitania Fluvial de Santarém", lat: -2.42167, lng: -54.71000 },
        salinopolis: { name: "Ponto Focal Salinópolis (Atalaia)", lat: -0.60000, lng: -47.36000 },
        custom: { name: "Ponto de Partida Personalizado", lat: -1.41111, lng: -48.48722 }
    };

    // Função de ordenação natural crescente:
    // 1. Códigos numéricos e decimais (ex: 32, 100, 319, 319.1, 319.3, 319A, 320) ordenados de forma crescente contínua.
    // 2. Códigos que iniciam com letras (ex: AP-01, BAP-01, PA-20) vêm na sequência em ordem alfabética natural.
    function compareSignalCodes(a, b) {
        const codeA = String(a && typeof a === 'object' ? (a.code || '') : (a || '')).trim();
        const codeB = String(b && typeof b === 'object' ? (b.code || '') : (b || '')).trim();

        const startsWithNumA = /^\d/.test(codeA);
        const startsWithNumB = /^\d/.test(codeB);

        // Se um começa com número e o outro não, numéricos vêm primeiro
        if (startsWithNumA && !startsWithNumB) return -1;
        if (!startsWithNumA && startsWithNumB) return 1;

        // Ambos começam com número ou ambos com letras:
        // Normaliza vírgulas para pontos decimais se houver (ex: 319,3 -> 319.3)
        const normA = codeA.replace(',', '.');
        const normB = codeB.replace(',', '.');

        return normA.localeCompare(normB, 'pt-BR', { numeric: true, sensitivity: 'base' });
    }

    // State Variables
    let signalsData = [];
    let selectedSignal = null;
    const selectedSignalCodes = new Set(); // Multi-signal selection for custom map view
    let currentFilter = 'all';
    let currentSearch = '';
    let currentTypeFilter = 'ALL'; // Category filter: ALL | FAROL | FAROLETE | BOIA | BALIZA
    let currentResponsavelFilter = 'ALL'; // Responsible filter: ALL | CHN-4 | CPAP | CPMA | CPPA | Extra-MB
    let isPickingPosition = false; // map-click-to-pick mode for new signal form
    let isPickingBasePosition = false; // map-click-to-pick mode for custom departure point
    
    // Waypoints for Navigation Route (Derrota Náutica)
    let routeWaypoints = []; 
    let waypointMarkers = [];
    let isDrawDerrotaMode = false;
    let isRouteVisible = true; // Control visibility of route markers and polyline on map
    let routeDynamicLine = null;
    let routeTooltip = null;

    // Map & Layers State
    let mapMarkers = {}; 
    let routePolyline = null;
    let isMeasureMode = false;
    let measurePoints = [];
    let measureDynamicLine = null;
    let measureTooltip = null;

    // Pin Coordinate Inspection State
    let isPinInspectMode = false;
    let pinInspectMarker = null;
    let pinInspectTooltip = null;

    // GeoTIFF Overlays State
    let geotiffLayers = []; // Array of { id, name, layer, opacity }
    const dhnGeoTiffGroup = L.layerGroup(); // Dedicated Layer Group for DHN GeoTIFF charts

    // =========================================================================
    // 2. INICIALIZAÇÃO DO MAPA LEAFLET E CAMADAS
    // =========================================================================
    const map = L.map('map', {
        center: [-0.5, -49.0],
        zoom: 8,
        zoomControl: false
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);
    const measureLayerGroup = L.layerGroup().addTo(map);
    const pinInspectLayerGroup = L.layerGroup().addTo(map);
    const routeLayerGroup = L.layerGroup().addTo(map);

    // Layer 1: Esri World Imagery
    const satLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri World Imagery',
        maxZoom: 18
    });

    // Layer 2: Google Satellite PURE (no labels, default)
    const googleSatLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Google Satellite',
        maxZoom: 20
    });

    // Layer 2b: Google Labels Overlay (city/road names - toggled separately)
    const googleLabelsLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=h&x={x}&y={y}&z={z}', {
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: 'Google Labels',
        maxZoom: 20,
        pane: 'overlayPane'
    });

    // Layer 3: Nautical Base Charts (OpenSeaMap & Esri Ocean)
    const esriOceanLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Esri Ocean Basemap',
        maxZoom: 13
    });

    const openSeaMapLayer = L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
        attribution: 'OpenSeaMap',
        maxZoom: 18
    });

    const nauticalGroup = L.layerGroup([esriOceanLayer, openSeaMapLayer]);
    // Por padrão: apenas o Satélite do Google sem rótulos e sem camadas IDEM ativadas
    googleSatLayer.addTo(map);

    // Servidor base WMS: usa o proxy local /api/wms-proxy quando rodando no servidor local, ou direto na web
    const isLocalHost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const geoserverWmsUrl = isLocalHost ? '/api/wms-proxy' : 'https://idem.marinha.mil.br/geoserver/wms';

    function attachWmsResilience(layer) {
        layer.on('tileerror', function(error) {
            const tile = error.tile;
            if (tile) {
                const retries = (tile._retryCount || 0) + 1;
                tile._retryCount = retries;
                if (retries <= 4) {
                    setTimeout(() => {
                        if (tile && tile.src) {
                            const cleanSrc = tile.src.split('&_retry=')[0];
                            tile.src = cleanSrc + '&_retry=' + Date.now() + '_' + retries;
                        }
                    }, retries * 1000);
                }
            }
        });
        return layer;
    }

    const defaultWmsOptions = {
        format: 'image/png',
        transparent: true,
        version: '1.1.1',
        uppercase: true,
        tileSize: 512,
        zoomOffset: -1,
        updateWhenIdle: true,
        updateWhenZooming: false,
        keepBuffer: 8
    };

    function createDHNChartWMS(layerName, title) {
        const layer = L.tileLayer.wms(geoserverWmsUrl, {
            ...defaultWmsOptions,
            layers: `carta_nautica:${layerName}`,
            attribution: `Marinha do Brasil / DHN (${title})`
        });
        return attachWmsResilience(layer);
    }

    // Mosaico com as principais Cartas Náuticas da jurisdição do CHN-4 (Belém, Macapá, Santarém, Maranhão)
    const mosaicoCartasChn4Wms = attachWmsResilience(L.tileLayer.wms(geoserverWmsUrl, {
        ...defaultWmsOptions,
        layers: 'carta_nautica:carta_320,carta_nautica:carta_321,carta_nautica:carta_303,carta_nautica:carta_304,carta_nautica:carta_4011,carta_nautica:carta_4020A,carta_nautica:carta_411,carta_nautica:carta_221,carta_nautica:carta_232',
        attribution: 'Marinha do Brasil / DHN (Mosaico de Cartas Náuticas CHN-4)'
    }));

    const carta320Wms = createDHNChartWMS('carta_320', 'Carta 320 - Porto de Belém');
    const carta321Wms = createDHNChartWMS('carta_321', 'Carta 321 - Porto de Vila do Conde');
    const carta303Wms = createDHNChartWMS('carta_303', 'Carta 303 - Baía do Guajará / Mosqueiro');
    const carta304Wms = createDHNChartWMS('carta_304', 'Carta 304 - Mosqueiro a Vila do Conde');
    const carta4011Wms = createDHNChartWMS('carta_4011', 'Carta 4011 - Macapá à Ilha Salvador');
    const carta4020AWms = createDHNChartWMS('carta_4020A', 'Carta 4020A - Porto de Santarém');
    const carta411Wms = createDHNChartWMS('carta_411', 'Carta 411 - Baía de São Marcos / Maranhão');
    const carta221Wms = createDHNChartWMS('carta_221', 'Carta 221 - Barra Norte do Rio Amazonas');
    const carta232Wms = createDHNChartWMS('carta_232', 'Carta 232 - Barra Sul do Rio Amazonas');

    const dhnEncLimitsWms = attachWmsResilience(L.tileLayer.wms(geoserverWmsUrl, {
        ...defaultWmsOptions,
        layers: 'carta_nautica:limites_enc',
        attribution: 'Marinha do Brasil / DHN / IDEM'
    }));

    const zeeWms = attachWmsResilience(L.tileLayer.wms(geoserverWmsUrl, {
        ...defaultWmsOptions,
        layers: 'leplac:ZONA_ECONOMICA_EXCLUSIVA',
        attribution: 'Marinha do Brasil / LEPLAC'
    }));

    const marTerritorialWms = attachWmsResilience(L.tileLayer.wms(geoserverWmsUrl, {
        ...defaultWmsOptions,
        layers: 'leplac:BR-12M-Line',
        attribution: 'Marinha do Brasil / DHN'
    }));

    const linhaBaseWms = attachWmsResilience(L.tileLayer.wms(geoserverWmsUrl, {
        ...defaultWmsOptions,
        layers: 'leplac:BaseLine_Complete_Line',
        attribution: 'Marinha do Brasil / DHN'
    }));

    const baseLayers = {
        "Satélite Google": googleSatLayer,
        "Satélite Esri Imagery": satLayer,
        "Carta Náutica Base (Ocean/OpenSeaMap)": nauticalGroup
    };

    const overlays = {
        "🗺️ Mosaico Cartas Náuticas CHN-4 (IDEM-DHN)": mosaicoCartasChn4Wms,
        "⚓ Carta 320 — Porto de Belém (DHN)": carta320Wms,
        "⚓ Carta 321 — Porto de Vila do Conde (DHN)": carta321Wms,
        "⚓ Carta 303 — Cabo Maguari a Mosqueiro (DHN)": carta303Wms,
        "⚓ Carta 304 — Mosqueiro a Vila do Conde (DHN)": carta304Wms,
        "⚓ Carta 4011 — Macapá à Ilha Salvador (DHN)": carta4011Wms,
        "⚓ Carta 4020A — Porto de Santarém (DHN)": carta4020AWms,
        "⚓ Carta 411 — Baía de São Marcos (DHN)": carta411Wms,
        "⚓ Carta 221 — Barra Norte do Rio Amazonas (DHN)": carta221Wms,
        "⚓ Carta 232 — Barra Sul do Rio Amazonas (DHN)": carta232Wms,
        "🏙️ Nomes de Cidades (Google)": googleLabelsLayer,
        "🗺️ Cartas Náuticas Locais (GeoTIFF .tif)": dhnGeoTiffGroup,
        "📐 Limites das Cartas Eletrônicas ENC (DHN)": dhnEncLimitsWms,
        "🌊 Limite da Zona Econômica Exclusiva ZEE (DHN)": zeeWms,
        "📏 Mar Territorial 12 Milhas (DHN)": marTerritorialWms,
        "📏 Linha de Base Marítima (DHN)": linhaBaseWms
    };

    L.control.layers(baseLayers, overlays, { position: 'topright' }).addTo(map);

    // Forçar redesenho WMS e recarregamento automático se a camada for ativada
    map.on('overlayadd', (e) => {
        if (e.layer && typeof e.layer.redraw === 'function') {
            e.layer.redraw();
        }
    });

    const activeNameSpan = document.getElementById('activeLayerName');
    if (activeNameSpan) activeNameSpan.textContent = "Satélite Google";

    map.on('baselayerchange', (e) => {
        const nameSpan = document.getElementById('activeLayerName');
        if (nameSpan) nameSpan.textContent = e.name;
    });

    // Auto-load local DHN GeoTIFF charts (e.g. 320geotiff.tif and 10geotiff.tif)
    async function autoLoadLocalDHNCharts() {
        const filesToTry = ['./cartas_geotiff/320geotiff.tif', './cartas_geotiff/10geotiff.tif'];
        for (const filePath of filesToTry) {
            try {
                const resp = await fetch(filePath);
                if (!resp.ok) continue;
                const arrayBuffer = await resp.arrayBuffer();

                if (typeof parseGeoRaster !== 'undefined') {
                    const georaster = await parseGeoRaster(arrayBuffer);
                    const layer = new GeoRasterLayer({
                        georaster: georaster,
                        opacity: 0.85,
                        resolution: 256
                    });

                    layer.addTo(dhnGeoTiffGroup);

                    const fname = filePath.split('/').pop();
                    const layerId = `dhn-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                    geotiffLayers.push({
                        id: layerId,
                        name: `Carta DHN (${fname})`,
                        layer: layer,
                        opacity: 0.85
                    });
                    renderGeoTIFFLayersList();
                }
            } catch (err) {
                console.warn(`Tentativa de autocarregar ${filePath}:`, err);
            }
        }
    }

    autoLoadLocalDHNCharts();

    // =========================================================================
    // 3. FÓRMULAS NÁUTICAS & AUXILIARES
    // =========================================================================
    function isOperational(status) {
        if (!status) return false;
        const s = String(status).trim().toUpperCase();
        return s === 'OPERACIONAL' || s === 'OPERANDO NORMALMENTE' || s.includes('🟢');
    }

    function haversineNM(lat1, lon1, lat2, lon2) {
        const R_NM = 3440.065;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R_NM * c;
    }

    function calculateBearing(lat1, lon1, lat2, lon2) {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        const θ = Math.atan2(y, x);
        const bearing = (θ * 180 / Math.PI + 360) % 360;
        return Math.round(bearing);
    }

    function formatNauticalCoord(val, isLat) {
        const num = parseFloat(val);
        if (isNaN(num)) return '--';
        const isNegative = num < 0;
        const abs = Math.abs(num);
        const deg = Math.floor(abs);
        const min = (abs - deg) * 60;
        
        const degPad = isLat ? 2 : 3;
        const degStr = String(deg).padStart(degPad, '0');
        const minStr = min.toFixed(2).padStart(5, '0');
        const dir = isLat ? (isNegative ? 'S' : 'N') : (isNegative ? 'W' : 'E');
        
        return `${degStr}° ${minStr}' ${dir}`;
    }

    function toDMS(deg, isLat) {
        return formatNauticalCoord(deg, isLat);
    }

    function getFormattedTimestampZ() {
        const now = new Date();
        const dd = String(now.getUTCDate()).padStart(2, '0');
        const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
        const yyyy = now.getUTCFullYear();
        const hh = String(now.getUTCHours()).padStart(2, '0');
        const min = String(now.getUTCMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${hh}:${min}Z`;
    }

    function showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let icon = '<i class="fa-solid fa-circle-info"></i>';
        if (type === 'success') icon = '<i class="fa-solid fa-circle-check"></i>';
        if (type === 'danger') icon = '<i class="fa-solid fa-triangle-exclamation"></i>';
        
        toast.innerHTML = `${icon} <span>${message}</span>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-100%)';
            setTimeout(() => toast.remove(), 300);
        }, 3800);
    }

    // =========================================================================
    // 4. BANCO DE DADOS CENTRAL MULTICAMADA (FIRESTORE / REST / INDEXEDDB / LOCALSTORAGE)
    // =========================================================================
    const IDB_NAME = 'chn4_aton_gis_db';
    const IDB_VERSION = 1;
    const IDB_STORE = 'signals_store';

    function openIndexedDB() {
        return new Promise((resolve) => {
            if (!window.indexedDB) return resolve(null);
            try {
                const req = window.indexedDB.open(IDB_NAME, IDB_VERSION);
                req.onupgradeneeded = (e) => {
                    const dbInstance = e.target.result;
                    if (!dbInstance.objectStoreNames.contains(IDB_STORE)) {
                        dbInstance.createObjectStore(IDB_STORE, { keyPath: 'id' });
                    }
                };
                req.onsuccess = (e) => resolve(e.target.result);
                req.onerror = (e) => {
                    console.warn('IndexedDB unavailable:', e);
                    resolve(null);
                };
            } catch (err) {
                console.warn('Erro ao abrir IndexedDB:', err);
                resolve(null);
            }
        });
    }

    async function saveIndexedDB(signals) {
        try {
            const idb = await openIndexedDB();
            if (!idb) return;
            const tx = idb.transaction(IDB_STORE, 'readwrite');
            const store = tx.objectStore(IDB_STORE);
            store.put({ id: 'current_signals', timestamp: Date.now(), data: signals });
        } catch (e) {
            console.warn('Erro ao salvar no IndexedDB:', e);
        }
    }

    async function loadIndexedDB() {
        try {
            const idb = await openIndexedDB();
            if (!idb) return null;
            return new Promise((resolve) => {
                const tx = idb.transaction(IDB_STORE, 'readonly');
                const store = tx.objectStore(IDB_STORE);
                const req = store.get('current_signals');
                req.onsuccess = () => {
                    if (req.result && Array.isArray(req.result.data) && req.result.data.length > 0) {
                        resolve(req.result.data);
                    } else {
                        resolve(null);
                    }
                };
                req.onerror = () => resolve(null);
            });
        } catch (e) {
            console.warn('Erro ao ler IndexedDB:', e);
            return null;
        }
    }

    function saveLocalCache() {
        try {
            const payload = {
                timestamp: Date.now(),
                signals: signalsData
            };
            localStorage.setItem('chn4_aton_signals_cache', JSON.stringify(payload));
        } catch (e) {
            console.warn('Aviso localStorage:', e);
        }
        saveIndexedDB(signalsData);
    }

    function loadLocalCache() {
        try {
            const raw = localStorage.getItem('chn4_aton_signals_cache');
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed && Array.isArray(parsed.signals) && parsed.signals.length > 0) {
                    return parsed.signals;
                }
            }
        } catch (e) {
            console.warn('Erro ao ler localStorage:', e);
        }
        return null;
    }

    // Client-side image resizer/compressor to ensure crystal-clear display under Firestore (<1MB) & storage limits
    function optimizeImage(file, maxWidth = 1280, maxHeight = 1280, quality = 0.82) {
        return new Promise((resolve) => {
            if (!file) {
                resolve(null);
                return;
            }
            const reader = new FileReader();
            reader.onload = (e) => {
                const dataResult = e.target.result;
                const img = new Image();
                img.onload = () => {
                    try {
                        let width = img.width || 800;
                        let height = img.height || 600;

                        if (width > maxWidth || height > maxHeight) {
                            if (width / height > maxWidth / maxHeight) {
                                height = Math.round((height * maxWidth) / width);
                                width = maxWidth;
                            } else {
                                width = Math.round((width * maxHeight) / height);
                                height = maxHeight;
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = Math.max(1, width);
                        canvas.height = Math.max(1, height);
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                            const dataUrl = canvas.toDataURL('image/jpeg', quality);
                            resolve(dataUrl);
                            return;
                        }
                    } catch (canvasErr) {
                        console.warn('Canvas optimization fallback to direct dataUrl:', canvasErr);
                    }
                    resolve(dataResult);
                };
                img.onerror = () => {
                    // Fallback to direct raw dataURL if browser canvas failed to render image element
                    console.warn('Image onload fallback to raw FileReader result');
                    resolve(dataResult);
                };
                img.src = dataResult;
            };
            reader.onerror = () => {
                console.error('FileReader failed to read image file');
                resolve(null);
            };
            reader.readAsDataURL(file);
        });
    }

    async function loadSignalsFromBackend() {
        let loadedSignals = null;

        // 1. Tentar API REST do servidor central (node server.js / python server.py / server.ps1)
        try {
            const resp = await fetch('/api/signals');
            if (resp.ok) {
                const data = await resp.json();
                if (Array.isArray(data) && data.length > 0) {
                    loadedSignals = Array.isArray(data[0]) ? data[0] : (data[0] && data[0].value ? data[0].value : data);
                }
            }
        } catch (e) {
            console.warn('API REST /api/signals indisponível.', e);
        }

        // 2. Tentar ler o arquivo de banco de dados central signals.json
        if (!loadedSignals) {
            try {
                const resp = await fetch('./signals.json');
                if (resp.ok) {
                    const data = await resp.json();
                    if (Array.isArray(data) && data.length > 0) {
                        loadedSignals = Array.isArray(data[0]) ? data[0] : (data[0] && data[0].value ? data[0].value : data);
                    }
                }
            } catch (e) {
                console.warn('signals.json indisponível.', e);
            }
        }

        // 3. Fallback para IndexedDB e cache local no navegador
        if (!loadedSignals) {
            const idbSignals = await loadIndexedDB();
            if (idbSignals && idbSignals.length > 0) {
                loadedSignals = idbSignals;
                console.log(`✅ Carregados ${idbSignals.length} sinais do IndexedDB com fotos persistidas.`);
            } else {
                const cached = loadLocalCache();
                if (cached && cached.length > 0) {
                    loadedSignals = cached;
                    console.log(`✅ Carregados ${cached.length} sinais do cache local do navegador.`);
                }
            }
        }

        if (loadedSignals && Array.isArray(loadedSignals) && loadedSignals.length > 0 && loadedSignals[0].code) {
            signalsData = loadedSignals;
            signalsData.sort(compareSignalCodes);
            saveLocalCache();
            console.log(`✅ Carregados ${signalsData.length} sinais da base de dados persistente.`);
        } else if (signalsData.length === 0) {
            signalsData = [...initialSignals];
            signalsData.sort(compareSignalCodes);
            console.log(`ℹ️ Inicializado com sinais padrão.`);
        }

        updateTypeFilterDropdown();
        updateIE();
        renderSelectedTray();
        renderMapMarkers();
        renderSignalList();
    }

    // =========================================================================
    // 5. PARSER E IMPORTADOR DE KML (GOOGLE EARTH)
    // =========================================================================
    async function loadKML(kmlSource) {
        let kmlText = kmlSource;

        if (typeof kmlSource === 'string' && (kmlSource.endsWith('.kml') || kmlSource.startsWith('http') || kmlSource.startsWith('./'))) {
            try {
                const resp = await fetch(kmlSource);
                if (!resp.ok) return;
                kmlText = await resp.text();
            } catch (err) {
                console.warn("KML fetch warning:", err);
                return;
            }
        }

        if (!kmlText) return;

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlText, "text/xml");
        const placemarks = xmlDoc.getElementsByTagName("Placemark");
        
        const imported = [];

        for (let i = 0; i < placemarks.length; i++) {
            const pm = placemarks[i];
            const nameNode = pm.getElementsByTagName("name")[0];
            const name = nameNode ? nameNode.textContent.trim() : `Sinal KML ${i + 1}`;

            const descNode = pm.getElementsByTagName("description")[0];
            const desc = descNode ? descNode.textContent.trim() : "";

            const imgMatch = desc.match(/<img [^>]*src=["']([^"']+)["']/i);
            const imageUrl = imgMatch ? imgMatch[1] : null;

            let nrord = null;
            let tipo = "Bóia de Balizamento";
            let situacao = "OPERACIONAL";
            let mensagem = "";

            const extData = pm.getElementsByTagName("ExtendedData")[0];
            if (extData) {
                const dataNodes = extData.getElementsByTagName("Data");
                for (let j = 0; j < dataNodes.length; j++) {
                    const data = dataNodes[j];
                    const dataName = data.getAttribute("name");
                    const valNode = data.getElementsByTagName("value")[0];
                    const val = valNode ? valNode.textContent.trim() : "";

                    if (dataName === "NRORD" && val) nrord = val;
                    if (dataName === "TIPO" && val) tipo = val;
                    if ((dataName === "SITUAÇÃO ACD ÚLTIMA INSPEÇÃO" || dataName === "SITUACAO") && val) situacao = val;
                    if (dataName === "MENSAGEM DE ALTERAÇÃO" && val) mensagem = val;
                }
            }

            const pointNode = pm.getElementsByTagName("Point")[0];
            if (pointNode) {
                const coordsNode = pointNode.getElementsByTagName("coordinates")[0];
                if (coordsNode && coordsNode.textContent) {
                    const coords = coordsNode.textContent.trim().split(',');
                    if (coords.length >= 2) {
                        const lng = parseFloat(coords[0]);
                        const lat = parseFloat(coords[1]);
                        const code = nrord ? nrord : `CHN-${i + 1}`;

                        let status = "OPERACIONAL";
                        const sitUpper = situacao.toUpperCase();
                        if (sitUpper.includes("DESAPARECIDO")) status = "DESAPARECIDO";
                        else if (sitUpper.includes("APAGADO") || sitUpper.includes("AVARIADO")) status = "APAGADO";
                        else if (sitUpper.includes("A DERIVA")) status = "A DERIVA";

                        let responsavel = "CHN-4";
                        if (desc.toUpperCase().includes("AMAPÁ") || code.startsWith("AP-")) responsavel = "CPAP";
                        else if (desc.toUpperCase().includes("MARANHÃO") || code.startsWith("MA-")) responsavel = "CPMA";
                        else if (code.startsWith("PA-")) responsavel = "CHN-4";

                        imported.push({
                            code: code,
                            name: name,
                            type: tipo,
                            status: status,
                            lat: lat,
                            lng: lng,
                            characteristic: "Lp. V. 5s 4m 6NM",
                            rangeNM: 6,
                            altitudeM: 4,
                            jurisdiction: `Jurisdição ${responsavel}`,
                            responsavel: responsavel,
                            image: imageUrl,
                            photoDate: imageUrl ? "2026-08-01" : null,
                            history: [
                                {
                                    date: "2026-08-10 10:00",
                                    status: status,
                                    note: mensagem || `Importado do KML. Situação: ${situacao}`
                                }
                            ]
                        });
                    }
                }
            }
        }

        if (imported.length > 0) {
            signalsData = imported;
            updateIE();
            renderMapMarkers();
            renderSignalList();
            showToast(`${imported.length} sinais importados do KML com sucesso!`, 'success');
        }
    }

    // KML & JSON File Upload / Export Listeners
    const inputKmlFile = document.getElementById('inputKmlFile');
    document.getElementById('btnImportKmlHeader')?.addEventListener('click', () => inputKmlFile.click());
    inputKmlFile?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => loadKML(event.target.result);
        reader.readAsText(file);
    });

    // Export JSON DB for Google Drive
    document.getElementById('btnExportJsonDb')?.addEventListener('click', () => {
        const jsonStr = JSON.stringify(signalsData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'signals.json';
        link.click();
        showToast('Arquivo signals.json gerado! Salve-o na pasta do Google Drive.', 'success');
    });

    // =========================================================================
    // 6. CARREGADOR DE CARTAS GEOTIFF (.TIF)
    // =========================================================================
    const inputGeotiffFile = document.getElementById('inputGeotiffFile');
    document.getElementById('btnUploadTifTab')?.addEventListener('click', () => inputGeotiffFile.click());

    async function loadGeoTIFFFile(file) {
        try {
            showToast(`Processando carta GeoTIFF: ${file.name}...`, 'info');
            const arrayBuffer = await file.arrayBuffer();

            if (typeof parseGeoRaster !== 'undefined') {
                const georaster = await parseGeoRaster(arrayBuffer);
                const layer = new GeoRasterLayer({
                    georaster: georaster,
                    opacity: 0.85,
                    resolution: 256
                });

                layer.addTo(map);
                map.fitBounds(layer.getBounds());

                const layerId = `tif-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
                geotiffLayers.push({
                    id: layerId,
                    name: file.name,
                    layer: layer,
                    opacity: 0.85
                });

                renderGeoTIFFLayersList();
                showToast(`Carta GeoTIFF ${file.name} sobreposta no mapa com sucesso!`, 'success');
            }
        } catch (err) {
            console.error("GeoTIFF parse error:", err);
            showToast(`Erro ao carregar arquivo GeoTIFF.`, 'warning');
        }
    }

    inputGeotiffFile?.addEventListener('change', async (e) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;
        for (let i = 0; i < files.length; i++) {
            await loadGeoTIFFFile(files[i]);
        }
    });

    function renderGeoTIFFLayersList() {
        const container = document.getElementById('geotiffLayersList');
        if (!container) return;
        container.innerHTML = '';

        if (geotiffLayers.length === 0) {
            container.innerHTML = '<div class="text-muted text-center p-3">Nenhum GeoTIFF sob demanda carregado. Exibindo Carta Náutica Base.</div>';
            return;
        }

        geotiffLayers.forEach(gt => {
            const item = document.createElement('div');
            item.className = 'geotiff-layer-item';
            item.innerHTML = `
                <div class="geotiff-layer-head">
                    <span><i class="fa-solid fa-map-location-dot text-gold"></i> ${gt.name}</span>
                    <button class="btn-remove-wp" onclick="window.removeGeoTIFFLayer('${gt.id}')" title="Remover Carta">&times;</button>
                </div>
                <div class="geotiff-opacity-slider">
                    <span>Opacidade:</span>
                    <input type="range" min="0" max="1" step="0.05" value="${gt.opacity}" onchange="window.setGeoTIFFOpacity('${gt.id}', this.value)">
                    <span>${Math.round(gt.opacity * 100)}%</span>
                </div>
            `;
            container.appendChild(item);
        });
    }

    window.removeGeoTIFFLayer = (id) => {
        const index = geotiffLayers.findIndex(l => l.id === id);
        if (index !== -1) {
            map.removeLayer(geotiffLayers[index].layer);
            geotiffLayers.splice(index, 1);
            renderGeoTIFFLayersList();
            showToast('Camada GeoTIFF removida.', 'info');
        }
    };

    window.setGeoTIFFOpacity = (id, val) => {
        const item = geotiffLayers.find(l => l.id === id);
        if (item && item.layer) {
            item.opacity = parseFloat(val);
            item.layer.setOpacity(parseFloat(val));
            renderGeoTIFFLayersList();
        }
    };

    // =========================================================================
    // 7. ÍNDICE DE EFICÁCIA (IE) & SIMULADOR
    // =========================================================================
    // 7. ÍNDICE DE EFICÁCIA (IE) NORMAM-601/DHN (Art. 2.48 e 2.49)
    // =========================================================================
    function getTypeCategory(type) {
        const t = (type || '').toUpperCase();
        if (t.includes('FAROLETE') || t === 'FTE') return 'FAROLETE';
        if (t.includes('FAROL') || t === 'FAR') return 'FAROL';
        if (t.includes('BALIZA') || t === 'BAL' || t.includes('BZ')) return 'BALIZA';
        if (t.includes('BOIA') || t.includes('BÓIA') || t.includes('BL') || t.includes('BC')) return 'BOIA';
        return 'OTHER';
    }

    function computeSignalInoperableDays(signal, currentYear, currentMonth) {
        const isOp = isOperational(signal.status);
        const now = new Date();
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const startOfCurrentMonth = new Date(currentYear, currentMonth - 1, 1, 0, 0, 0);
        
        // Janela anual móvel dos 12 últimos meses (alterada no dia 01 de cada mês):
        // Cobre exatamente os 12 meses anteriores/atuais (base de 12 x 30 = 360 dias)
        // Ex: Em Agosto/2026, cobre de 01/Setembro/2025 a 31/Agosto/2026
        const startOf12MonthsWindow = new Date(currentYear, currentMonth - 12, 1, 0, 0, 0);

        let inopStart = null;
        if (signal.occurrenceStartDate || signal.inoperableSince) {
            const dt = new Date(signal.occurrenceStartDate || signal.inoperableSince);
            if (!isNaN(dt.getTime())) inopStart = dt;
        }

        let a_mes = 0;
        let a_ano = 0;

        if (!isOp) {
            if (!inopStart) inopStart = startOfCurrentMonth;

            // 1. CÔMPUTO NO MÊS CONSIDERADO (NORMAM-601 Art 2.48 / 2.49)
            // Se o sinal apagou/avariou antes do início do mês atual e segue inoperante:
            if (inopStart <= startOfCurrentMonth) {
                a_mes = 30; // 100% dos dias do mês inoperante
            } else {
                // Falhou durante o mês atual:
                const diffMes = (now - inopStart) / (1000 * 60 * 60 * 24);
                if (diffMes >= 1) {
                    a_mes = Math.min(30, diffMes);
                }
            }

            // 2. CÔMPUTO NA JANELA ANUAL DOS 12 ÚLTIMOS MESES MÓVEIS (Base = 12 * 30 = 360 dias)
            for (let m = 0; m < 12; m++) {
                const mStart = new Date(currentYear, currentMonth - 12 + m, 1, 0, 0, 0);
                const mEnd = new Date(currentYear, currentMonth - 12 + m + 1, 0, 23, 59, 59);

                if (m === 11) {
                    // Mês corrente (12º mês da janela):
                    if (inopStart <= mStart) {
                        a_ano += 30;
                    } else if (inopStart <= now) {
                        const diffCur = (now - inopStart) / (1000 * 60 * 60 * 24);
                        a_ano += Math.min(30, Math.max(0, diffCur));
                    }
                } else {
                    // Meses anteriores da janela de 12 meses:
                    if (inopStart <= mStart) {
                        a_ano += 30; // Esteve inoperante durante todo este mês
                    } else if (inopStart <= mEnd) {
                        const daysInThisMonth = new Date(mStart.getFullYear(), mStart.getMonth() + 1, 0).getDate();
                        const daysRemaining = Math.max(0, daysInThisMonth - inopStart.getDate() + 1);
                        a_ano += Math.min(30, daysRemaining);
                    }
                }
            }
        }

        // Histórico de ocorrências passadas (já restabelecidas) dentro da janela de 12 meses
        if (signal.history && Array.isArray(signal.history) && signal.history.length > 0) {
            let histInopStart = null;
            signal.history.forEach(h => {
                const hDate = new Date(h.startDate || h.date);
                if (!isNaN(hDate.getTime())) {
                    if (!isOperational(h.status)) {
                        if (!histInopStart || hDate < histInopStart) histInopStart = hDate;
                    } else if (histInopStart) {
                        const inopEnd = hDate;
                        // Contabilizar período já sanado nos 12 últimos meses
                        const startAno = histInopStart < startOf12MonthsWindow ? startOf12MonthsWindow : histInopStart;
                        if (inopEnd > startOf12MonthsWindow && startAno < inopEnd) {
                            const dAno = (inopEnd - startAno) / (1000 * 60 * 60 * 24);
                            if (dAno >= 1 && isOp) a_ano += dAno;
                        }
                        // Contabilizar período já sanado no mês corrente
                        const startMes = histInopStart < startOfCurrentMonth ? startOfCurrentMonth : histInopStart;
                        if (inopEnd > startOfCurrentMonth && startMes < inopEnd) {
                            const dMes = (inopEnd - startMes) / (1000 * 60 * 60 * 24);
                            if (dMes >= 1 && isOp) a_mes += dMes;
                        }
                        histInopStart = null;
                    }
                }
            });
        }

        return {
            a_mes: Math.min(30, a_mes),
            a_ano: Math.min(360, a_ano),
            daysInMonth
        };
    }

    function updateIE() {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1; // 1 a 12 (ex: 8 = Agosto)
        const monthNames = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const monthShortNames = ['', 'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

        // Janela dos 12 últimos meses móveis:
        const startWindowDate = new Date(currentYear, currentMonth - 12, 1);
        const startWindowMonthName = monthShortNames[startWindowDate.getMonth() + 1];
        const startWindowYear = String(startWindowDate.getFullYear()).slice(-2);
        const curMonthNameShort = monthShortNames[currentMonth];
        const curYearShort = String(currentYear).slice(-2);

        // 1. Filtrar estritamente sinais sob jurisdição e responsabilidade do CHN-4
        const chn4Signals = signalsData.filter(s => (s.responsavel || 'CHN-4') === 'CHN-4');
        const B = chn4Signals.length; // Total de sinais do balizamento CHN-4

        // 2. Calcular o somatório dos dias de alteração (A) no mês e nos 12 últimos meses
        let A_mensal = 0;
        let A_anual = 0;
        let chn4AvCount = 0;

        chn4Signals.forEach(signal => {
            const isOp = isOperational(signal.status);
            if (!isOp) {
                chn4AvCount++;
            }

            const inopData = computeSignalInoperableDays(signal, currentYear, currentMonth);
            A_mensal += inopData.a_mes;
            A_anual += inopData.a_ano;
        });

        // Arredondamento para números inteiros ou 1 casa decimal de dias
        const aMensalRounded = Math.round(A_mensal * 10) / 10;
        const aAnualRounded = Math.round(A_anual * 10) / 10;

        // 3. Fórmulas NORMAM-601:
        // IE mensal = [1 - (A / (B * 30))] * 100
        // IE anual (12 Últimos Meses) = [1 - (A / (B * 30 * 12))] * 100 = [1 - (A / (B * 360))] * 100
        let ieMensalVal = 100.0;
        let ieAnualVal = 100.0;

        if (B > 0) {
            const factorMensal = B * 30;
            const factorAnual = B * 360; // 12 meses móveis * 30 dias
            ieMensalVal = Math.max(0, Math.min(100, (1 - (aMensalRounded / factorMensal)) * 100));
            ieAnualVal = Math.max(0, Math.min(100, (1 - (aAnualRounded / factorAnual)) * 100));
        }

        const ieMensalStr = ieMensalVal.toFixed(2).replace('.', ',');
        const ieAnualStr = ieAnualVal.toFixed(2).replace('.', ',');

        // Header pill
        const headerVal = document.getElementById('headerIeValue');
        if (headerVal) {
            headerVal.textContent = `${ieMensalStr}%`;
            headerVal.style.color = ieMensalVal >= 95 ? 'var(--status-op)' : (ieMensalVal >= 80 ? 'var(--accent-gold)' : 'var(--status-av)');
        }

        // Tab IE DOM Elements
        const iePercentDisplay = document.getElementById('iePercentDisplay');
        const ieAnualDisplay = document.getElementById('ieAnualDisplay');
        const ieGaugeValue = document.getElementById('ieGaugeValue');
        const circleGauge = document.getElementById('ieCircleGauge');
        const ieMensalSubtitle = document.getElementById('ieMensalSubtitle');
        const ieAnualSubtitle = document.getElementById('ieAnualSubtitle');

        if (iePercentDisplay) iePercentDisplay.textContent = `${ieMensalStr}%`;
        if (ieAnualDisplay) ieAnualDisplay.textContent = `${ieAnualStr}%`;
        if (ieGaugeValue) ieGaugeValue.textContent = `${ieMensalStr}%`;
        if (ieMensalSubtitle) ieMensalSubtitle.textContent = `Mês Atual: ${monthNames[currentMonth]}/${currentYear}`;
        if (ieAnualSubtitle) ieAnualSubtitle.textContent = `Últimos 12 Meses (${startWindowMonthName}/${startWindowYear} a ${curMonthNameShort}/${curYearShort})`;

        const paramBVal = document.getElementById('paramBVal');
        const paramDVal = document.getElementById('paramDVal');
        const paramAMensalVal = document.getElementById('paramAMensalVal');
        const paramAAnualVal = document.getElementById('paramAAnualVal');

        if (paramBVal) paramBVal.textContent = `${B} sinais`;
        if (paramDVal) paramDVal.textContent = `12 meses (Janela Móvel)`;
        if (paramAMensalVal) paramAMensalVal.textContent = `${aMensalRounded} dias`;
        if (paramAAnualVal) paramAAnualVal.textContent = `${aAnualRounded} dias (de ${B * 360} dias)`;

        const statOpCount = document.getElementById('statOpCount');
        const statAvCount = document.getElementById('statAvCount');
        const chn4OpCount = B - chn4AvCount;

        if (statOpCount) statOpCount.textContent = chn4OpCount;
        if (statAvCount) statAvCount.textContent = chn4AvCount;

        const boiaCount = chn4Signals.filter(s => getTypeCategory(s.type) === 'BOIA').length;
        const balizaCount = chn4Signals.filter(s => getTypeCategory(s.type) === 'BALIZA').length;
        const farolCount = chn4Signals.filter(s => getTypeCategory(s.type) === 'FAROL' || getTypeCategory(s.type) === 'FAROLETE').length;
        const statBoiaEl = document.getElementById('statBoiaCount');
        const statBalizaEl = document.getElementById('statBalizaCount');
        const statFarolEl = document.getElementById('statFarolCount');
        if (statBoiaEl) statBoiaEl.textContent = boiaCount;
        if (statBalizaEl) statBalizaEl.textContent = balizaCount;
        if (statFarolEl) statFarolEl.textContent = farolCount;

        if (circleGauge) {
            const deg = (parseFloat(ieMensalStr) / 100) * 360;
            const color = parseFloat(ieMensalStr) >= 95 ? 'var(--status-op)' : (parseFloat(ieMensalStr) >= 80 ? 'var(--accent-gold)' : 'var(--status-av)');
            circleGauge.style.background = `conic-gradient(${color} 0deg ${deg}deg, var(--navy-700) ${deg}deg 360deg)`;
        }

        // Global count badges for Tab 1
        const total = signalsData.length;
        const totalOp = signalsData.filter(s => isOperational(s.status)).length;
        const totalAv = total - totalOp;
        if (document.getElementById('countAll')) document.getElementById('countAll').textContent = total;
        if (document.getElementById('countOp')) document.getElementById('countOp').textContent = totalOp;
        if (document.getElementById('countAv')) document.getElementById('countAv').textContent = totalAv;
    }

    function openSimulator() {
        const modal = document.getElementById('modalSimulator');
        const checklist = document.getElementById('simChecklist');
        if (!modal || !checklist) return;

        const damagedSignals = signalsData.filter(s => !isOperational(s.status));
        checklist.innerHTML = '';

        if (damagedSignals.length === 0) {
            checklist.innerHTML = '<div class="text-muted p-2">Nenhum sinal avariado registrado no momento. Todos operacionais!</div>';
        } else {
            damagedSignals.forEach(s => {
                const item = document.createElement('label');
                item.className = 'sim-item';
                item.innerHTML = `
                    <input type="checkbox" value="${s.code}" class="sim-checkbox" checked>
                    <div>
                        <strong>${s.code} - ${s.name}</strong>
                        <div class="text-muted" style="font-size:0.75rem;">Status atual: <span class="text-danger">${s.status}</span> | ${s.characteristic}</div>
                    </div>
                `;
                checklist.appendChild(item);
            });
        }

        calculateSimulation();
        modal.classList.add('active');

        checklist.querySelectorAll('.sim-checkbox').forEach(cb => {
            cb.addEventListener('change', calculateSimulation);
        });
    }

    function calculateSimulation() {
        const total = signalsData.length;
        const currentOp = signalsData.filter(s => isOperational(s.status)).length;
        const currentIE = total > 0 ? (currentOp / total) * 100 : 0;

        const checkedBoxes = document.querySelectorAll('.sim-checkbox:checked');
        const countSimRepaired = checkedBoxes.length;
        const projectedOp = currentOp + countSimRepaired;
        const projectedIE = total > 0 ? (projectedOp / total) * 100 : 0;
        const deltaIE = projectedIE - currentIE;

        document.getElementById('simCurrentIe').textContent = `${currentIE.toFixed(2).replace('.', ',')}%`;
        document.getElementById('simCurrentRatio').textContent = `${currentOp} / ${total} operacionais`;
        document.getElementById('simProjectedIe').textContent = `${projectedIE.toFixed(2).replace('.', ',')}%`;
        document.getElementById('simProjectedRatio').textContent = `${projectedOp} / ${total} operacionais`;
        document.getElementById('simDeltaIe').textContent = `+${deltaIE.toFixed(2).replace('.', ',')}%`;
        document.getElementById('simCountRepaired').textContent = countSimRepaired;
    }

    // Type Filter Select Listener
    document.getElementById('typeFilterSelect')?.addEventListener('change', () => {
        renderMapMarkers();
        renderSignalList();
    });

    // Responsável Layer Checkbox Listeners
    ['chkRespCHN4', 'chkRespCPAP', 'chkRespCPMA', 'chkRespExtra'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', () => {
            renderMapMarkers();
            renderSignalList();
        });
    });

    document.getElementById('btnOnlyCHN4')?.addEventListener('click', () => {
        const c1 = document.getElementById('chkRespCHN4');
        const c2 = document.getElementById('chkRespCPAP');
        const c3 = document.getElementById('chkRespCPMA');
        const c5 = document.getElementById('chkRespExtra');
        if (c1) c1.checked = true;
        if (c2) c2.checked = false;
        if (c3) c3.checked = false;
        if (c5) c5.checked = false;
        renderMapMarkers();
        renderSignalList();
    });

    document.getElementById('btnSelectAllResp')?.addEventListener('click', () => {
        const c1 = document.getElementById('chkRespCHN4');
        const c2 = document.getElementById('chkRespCPAP');
        const c3 = document.getElementById('chkRespCPMA');
        const c5 = document.getElementById('chkRespExtra');
        if (c1) c1.checked = true;
        if (c2) c2.checked = true;
        if (c3) c3.checked = true;
        if (c5) c5.checked = true;
        renderMapMarkers();
        renderSignalList();
    });

    // =========================================================================
    // 8. RENDERIZAÇÃO E FILTRAGEM DE MARCADORES E LISTA (COM RESPONSÁVEL)
    // =========================================================================
    function getSignalIconClass(type) {
        const cat = getTypeCategory(type);
        if (cat === 'BOIA') return 'fa-anchor';
        if (cat === 'BALIZA') return 'fa-sign-hanging';
        return 'fa-tower-observation';
    }

    function createCustomIcon(signal) {
        const isOp = isOperational(signal.status);
        const statusClass = isOp ? 'status-op' : 'status-av';
        const iconType = getSignalIconClass(signal.type);

        return L.divIcon({
            className: 'custom-aton-marker-wrapper',
            html: `<div class="aton-marker ${statusClass}" title="${signal.code} - ${signal.name} (${signal.responsavel || 'CHN-4'})">
                     <i class="fa-solid ${iconType}"></i>
                   </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });
    }

    // =========================================================================
    // NAVAL TYPE MAP & PARSER (FAR, FTE, BL, BC, BZ, BZA, BA, BF, RF, RACON, AIS, ERDGPS)
    // =========================================================================
    const NAVAL_TYPE_MAP = {
        'BL':     { name: 'BL — Bóia Luminosa', order: 1 },
        'BC':     { name: 'BC — Bóia Cega', order: 2 },
        'BZ':     { name: 'BZ — Baliza', order: 3 },
        'FAR':    { name: 'FAR — Farol', order: 4 },
        'FTE':    { name: 'FTE — Farolete', order: 5 },
        'BZA':    { name: 'BZA — Baliza Articulada', order: 6 },
        'BA':     { name: 'BA — Bóia Articulada', order: 7 },
        'BF':     { name: 'BF — Barca-Farol', order: 8 },
        'RF':     { name: 'RF — Radiofarol', order: 9 },
        'RACON':  { name: 'RACON — Radar Beacon', order: 10 },
        'AIS':    { name: 'AIS — Transponder AIS', order: 11 },
        'ERDGPS': { name: 'ERDGPS — Estação DGPS', order: 12 }
    };

    function getSignalTypeKey(signal) {
        if (!signal) return 'OUTROS';
        const type = String(signal.type || '').trim().toUpperCase();
        const code = String(signal.code || '').trim().toUpperCase();
        const name = String(signal.name || '').trim().toUpperCase();

        if (type === 'BC' || type.includes('CEGA') || type.includes('SEM LUZ')) {
            return 'BC';
        }
        if (type === 'BZA' || type.includes('BALIZA ARTICULADA')) {
            return 'BZA';
        }
        if (type === 'BA' || type.includes('BOIA ARTICULADA') || type.includes('BÓIA ARTICULADA')) {
            return 'BA';
        }
        if (type === 'BZ' || type === 'BALIZA' || name.startsWith('BALIZA')) {
            return 'BZ';
        }
        if (type === 'BL' || type.includes('BALIZAMENTO') || type.includes('LUMINOSA') || type.includes('BOIA') || type.includes('BÓIA')) {
            return 'BL';
        }
        if (type === 'FAROL' || type === 'FAR' || name.startsWith('FAROL')) {
            return 'FAR';
        }
        if (type === 'FAROLETE' || type === 'FTE' || name.startsWith('FAROLETE')) {
            return 'FTE';
        }
        if (type === 'BF' || type.includes('BARCA')) {
            return 'BF';
        }
        if (type === 'RF' || type.includes('RADIO')) {
            return 'RF';
        }
        if (type.includes('RACON') || code.includes('RACON') || name.includes('RACON')) {
            return 'RACON';
        }
        if (type.includes('AIS') || code.includes('AIS') || name.includes('AIS')) {
            return 'AIS';
        }
        if (type.includes('DGPS') || code.includes('DGPS')) {
            return 'ERDGPS';
        }

        if (/^FAR[\s\-_0-9]/i.test(code) || /^FAR$/i.test(code)) return 'FAR';
        if (/^FTE[\s\-_0-9]/i.test(code) || /^FTE$/i.test(code)) return 'FTE';
        if (/^BZA[\s\-_0-9]/i.test(code) || /^BZA$/i.test(code)) return 'BZA';
        if (/^BA[\s\-_0-9]/i.test(code) || /^BA$/i.test(code)) return 'BA';
        if (/^BL[\s\-_0-9]/i.test(code) || /^BL$/i.test(code)) return 'BL';
        if (/^BC[\s\-_0-9]/i.test(code) || /^BC$/i.test(code)) return 'BC';
        if (/^BZ[\s\-_0-9]/i.test(code) || /^BZ$/i.test(code)) return 'BZ';
        if (/^BF[\s\-_0-9]/i.test(code) || /^BF$/i.test(code)) return 'BF';
        if (/^RF[\s\-_0-9]/i.test(code) || /^RF$/i.test(code)) return 'RF';

        return 'OUTROS';
    }

    function updateTypeFilterDropdown() {
        const select = document.getElementById('typeFilterSelect');
        if (!select) return;

        const currentSelection = select.value || 'ALL';
        const counts = {};

        signalsData.forEach(s => {
            const key = getSignalTypeKey(s);
            counts[key] = (counts[key] || 0) + 1;
        });

        let html = `<option value="ALL">Todos os Tipos (${signalsData.length})</option>`;

        const keysPresent = Object.keys(counts).sort((a, b) => {
            const orderA = NAVAL_TYPE_MAP[a] ? NAVAL_TYPE_MAP[a].order : 99;
            const orderB = NAVAL_TYPE_MAP[b] ? NAVAL_TYPE_MAP[b].order : 99;
            return orderA - orderB;
        });

        keysPresent.forEach(key => {
            const labelInfo = NAVAL_TYPE_MAP[key];
            const label = labelInfo ? labelInfo.name : `${key} — Outros Auxílios`;
            html += `<option value="${key}">${label} (${counts[key]})</option>`;
        });

        select.innerHTML = html;
        if (keysPresent.includes(currentSelection) || currentSelection === 'ALL') {
            select.value = currentSelection;
        } else {
            select.value = 'ALL';
        }
    }

    function matchesTypeFilter(signal) {
        const select = document.getElementById('typeFilterSelect');
        const filterVal = select ? select.value : 'ALL';
        if (!filterVal || filterVal === 'ALL') return true;

        return getSignalTypeKey(signal) === filterVal;
    }

    function getSelectedResponsaveis() {
        const selected = [];
        if (document.getElementById('chkRespCHN4')?.checked) selected.push('CHN-4');
        if (document.getElementById('chkRespCPAP')?.checked) selected.push('CPAP');
        if (document.getElementById('chkRespCPMA')?.checked) selected.push('CPMA');
        if (document.getElementById('chkRespExtra')?.checked) selected.push('EXTRA-MB', 'ÓRGÃOS EXTRA-MB', 'PRIVADO');
        return selected;
    }

    function matchesResponsavelFilter(signal) {
        const selected = getSelectedResponsaveis();
        if (selected.length === 0) return false;

        const resp = (signal.responsavel || 'CHN-4').toUpperCase();

        return selected.some(s => {
            if (s === 'EXTRA-MB') {
                return resp.includes('EXTRA') || resp.includes('PRIVADO') || resp.includes('ÓRGÃOS');
            }
            return resp === s;
        });
    }

    function getFilteredSignals() {
        const filtered = signalsData.filter(s => {
            if (currentFilter === 'selected') {
                return selectedSignalCodes.has(s.code);
            }

            const matchesFilter = currentFilter === 'all' ||
                (currentFilter === 'op' && isOperational(s.status)) ||
                (currentFilter === 'av' && !isOperational(s.status));
            
            const searchLower = (currentSearch || '').toLowerCase();
            const matchesSearch = !searchLower ||
                s.code.toLowerCase().includes(searchLower) ||
                s.name.toLowerCase().includes(searchLower) ||
                (s.jurisdiction && s.jurisdiction.toLowerCase().includes(searchLower)) ||
                (s.responsavel && s.responsavel.toLowerCase().includes(searchLower));

            return matchesFilter && matchesSearch && matchesTypeFilter(s) && matchesResponsavelFilter(s);
        });

        return filtered.sort(compareSignalCodes);
    }

    function renderSelectedTray() {
        const tray = document.getElementById('selectedSignalsTray');
        const countBadge = document.getElementById('trayCountBadge');
        const countSelectedEl = document.getElementById('countSelected');
        const pillSel = document.getElementById('pillFilterSelected');
        const chipsContainer = document.getElementById('selectedSignalsChips');

        const count = selectedSignalCodes.size;
        if (countBadge) countBadge.textContent = count;
        if (countSelectedEl) countSelectedEl.textContent = count;

        if (count === 0) {
            if (tray) tray.style.display = 'none';
            if (pillSel) pillSel.style.display = 'none';
            if (currentFilter === 'selected') {
                currentFilter = 'all';
                document.querySelectorAll('.pill-btn').forEach(p => {
                    if (p.getAttribute('data-filter') === 'all') p.classList.add('active');
                    else p.classList.remove('active');
                });
                renderSignalList();
                renderMapMarkers();
            }
            return;
        }

        if (tray) tray.style.display = 'flex';
        if (pillSel) pillSel.style.display = 'inline-flex';

        if (chipsContainer) {
            chipsContainer.innerHTML = '';
            selectedSignalCodes.forEach(code => {
                const sig = signalsData.find(s => s.code === code);
                const chip = document.createElement('div');
                chip.className = 'signal-chip';
                chip.title = 'Clique para focar no mapa';
                chip.innerHTML = `
                    <i class="fa-solid fa-anchor text-cyan"></i>
                    <span class="chip-code">${code}</span>
                    <span>${sig ? sig.name : ''}</span>
                    <button type="button" class="chip-remove" onclick="event.stopPropagation(); window.toggleSelectSignal('${code}')" title="Desmarcar">&times;</button>
                `;
                chip.addEventListener('click', () => {
                    window.focusSelectedSignal(code);
                });
                chipsContainer.appendChild(chip);
            });
        }
    }

    window.toggleSelectSignal = (code, forceState) => {
        if (!code) return;
        const exists = selectedSignalCodes.has(code);
        let willBeSelected = exists;

        if (forceState === true) {
            selectedSignalCodes.add(code);
            willBeSelected = true;
        } else if (forceState === false) {
            selectedSignalCodes.delete(code);
            willBeSelected = false;
        } else {
            if (exists) {
                selectedSignalCodes.delete(code);
                willBeSelected = false;
            } else {
                selectedSignalCodes.add(code);
                willBeSelected = true;
            }
        }

        const sig = signalsData.find(s => s.code === code);
        if (willBeSelected) {
            showToast(`Sinal ${code}${sig ? ' (' + sig.name + ')' : ''} selecionado para o mapa.`, 'info');
        } else {
            showToast(`Sinal ${code} removido da seleção.`, 'info');
        }

        renderSelectedTray();
        renderSignalList();
        renderMapMarkers();

        if (willBeSelected) {
            if (selectedSignalCodes.size === 1 && sig) {
                map.flyTo([sig.lat, sig.lng], 12, { duration: 0.8 });
            } else if (selectedSignalCodes.size > 1) {
                fitSelectedSignals();
            }
        }
    };

    function fitSelectedSignals() {
        if (selectedSignalCodes.size === 0) return;
        const list = signalsData.filter(s => selectedSignalCodes.has(s.code));
        if (list.length === 0) return;
        if (list.length === 1) {
            map.flyTo([list[0].lat, list[0].lng], 12, { duration: 1.0 });
            return;
        }
        const bounds = L.latLngBounds(list.map(s => [s.lat, s.lng]));
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 13 });
    }
    window.fitSelectedSignals = fitSelectedSignals;

    window.focusSelectedSignal = (code) => {
        const sig = signalsData.find(s => s.code === code);
        if (!sig) return;
        map.flyTo([sig.lat, sig.lng], 13, { duration: 1.0 });
        if (mapMarkers[code]) {
            mapMarkers[code].openPopup();
        }
        highlightSignalCard(code);
    };

    function restoreDefaultCHN4View() {
        selectedSignalCodes.clear();
        currentSearch = '';
        if (searchInput) searchInput.value = '';
        currentFilter = 'all';
        document.querySelectorAll('.pill-btn').forEach(p => {
            if (p.getAttribute('data-filter') === 'all') p.classList.add('active');
            else p.classList.remove('active');
        });

        // Set Responsáveis to CHN-4 only
        const c1 = document.getElementById('chkRespCHN4');
        const c2 = document.getElementById('chkRespCPAP');
        const c3 = document.getElementById('chkRespCPMA');
        const c5 = document.getElementById('chkRespExtra');
        if (c1) c1.checked = true;
        if (c2) c2.checked = false;
        if (c3) c3.checked = false;
        if (c5) c5.checked = false;

        currentTypeFilter = 'ALL';
        if (typeFilterSelect) typeFilterSelect.value = 'ALL';

        renderSelectedTray();
        renderSignalList();
        renderMapMarkers();
        map.flyTo([-0.5, -49.0], 8, { duration: 1.2 });
        showToast('Visualização padrão dos sinais CHN-4 restaurada.', 'success');
    }
    window.restoreDefaultCHN4View = restoreDefaultCHN4View;

    function renderMapMarkers() {
        Object.values(mapMarkers).forEach(m => map.removeLayer(m));
        mapMarkers = {};

        // If custom selection is active, exclusively show selected signals
        const visibleSignals = (selectedSignalCodes.size > 0)
            ? signalsData.filter(s => selectedSignalCodes.has(s.code))
            : getFilteredSignals();

        visibleSignals.forEach(signal => {
            const marker = L.marker([signal.lat, signal.lng], {
                icon: createCustomIcon(signal)
            }).addTo(map);

            const isOp = isOperational(signal.status);
            const respClass = (signal.responsavel === 'CPAP') ? 'resp-cpap' : (signal.responsavel === 'CPMA') ? 'resp-cpma' : (signal.responsavel === 'Extra-MB') ? 'resp-extra' : 'resp-chn4';

            const fullType = getFullTypeName(signal.type);
            const popupHtml = `
                <div style="font-family: var(--font-sans); padding: 4px 6px; min-width: 210px;">
                    <div style="display: flex; gap: 6px; align-items: center; margin-bottom: 4px;">
                        <span class="badge ${isOp ? 'badge-op' : 'badge-av'}">${signal.status}</span>
                        <span class="responsavel-badge ${respClass}"><i class="fa-solid fa-building-user"></i> ${signal.responsavel || 'CHN-4'}</span>
                    </div>
                    <h3 style="font-family: var(--font-tech); margin: 4px 0 2px 0; font-size: 1.05rem; color: #0f172a;">${signal.code} - ${signal.name}</h3>
                    <p style="margin: 3px 0; font-size: 0.82rem; color: #334155;"><strong>Tipo:</strong> ${fullType}</p>
                    <p style="margin: 3px 0; font-size: 0.82rem; color: #334155;"><strong>Carac:</strong> ${signal.characteristic}</p>
                    <p style="margin: 3px 0 8px 0; font-size: 0.82rem; color: #334155;"><strong>Posição:</strong> <span style="font-weight: 600; color: #0f172a;">${formatNauticalCoord(signal.lat, true)} | ${formatNauticalCoord(signal.lng, false)}</span></p>
                    <div style="display: flex; gap: 6px;">
                        <button type="button" onclick="window.openSignalDetail('${signal.code}')" style="background: #1e3a66; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.8rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 5px;">
                            <i class="fa-solid fa-file-lines"></i> Ficha DH2
                        </button>
                    </div>
                </div>
            `;
            marker.bindPopup(popupHtml);

            marker.on('click', () => {
                highlightSignalCard(signal.code);
            });

            mapMarkers[signal.code] = marker;
        });
    }

    function getFullTypeName(type) {
        const t = (type || '').toUpperCase().trim();
        if (t.includes('FAROLETE') || t === 'FTE') return 'Farolete';
        if (t.includes('FAROL') || t === 'FAR') return 'Farol';
        if (t.includes('BALIZA') || t === 'BAL' || t.includes('BZ')) return 'Baliza';
        if (t.includes('BC') || t.includes('BOIA CEGA') || t.includes('BÓIA CEGA')) return 'Bóia Cega';
        if (t.includes('BL') || t.includes('BOIA LUMINOSA') || t.includes('BÓIA LUMINOSA')) return 'Bóia Luminosa';
        if (t.includes('BOIA') || t.includes('BÓIA')) return 'Bóia';
        if (t.includes('RACON') || t.includes('RADAR')) return 'Respondedor Radar (Racon)';
        if (t.includes('CARDINAL')) return 'Sinal Cardinal';
        if (t.includes('LUZ') || t.includes('PORTO')) return 'Luz / Lanterna';
        return type || 'Sinal Náutico';
    }

    function renderSignalList() {
        const container = document.getElementById('signalList');
        if (!container) return;

        container.innerHTML = '';

        const filtered = getFilteredSignals();

        if (filtered.length === 0) {
            container.innerHTML = '<div class="text-muted p-3 text-center">Nenhum auxílio à navegação encontrado para os filtros selecionados.</div>';
            return;
        }

        filtered.forEach(s => {
            const isOp = isOperational(s.status);
            const isSelected = selectedSignalCodes.has(s.code);
            const card = document.createElement('div');
            card.className = `signal-card ${isOp ? 'status-op' : 'status-av'} ${isSelected ? 'is-card-selected' : ''}`;
            card.id = `card-${s.code}`;
            card.setAttribute('draggable', 'true');

            const respClass = (s.responsavel === 'CPAP') ? 'resp-cpap' : (s.responsavel === 'CPMA') ? 'resp-cpma' : (s.responsavel === 'Extra-MB') ? 'resp-extra' : 'resp-chn4';
            const fullType = getFullTypeName(s.type);

            card.innerHTML = `
                <div class="signal-card-head">
                    <div class="signal-code-title">
                        <button type="button" class="btn-card-select ${isSelected ? 'checked' : ''}" onclick="event.stopPropagation(); window.toggleSelectSignal('${s.code}')" title="${isSelected ? 'Remover da visualização conjunta' : 'Marcar para visualizar no mapa'}">
                            <i class="fa-solid ${isSelected ? 'fa-square-check' : 'fa-square'}"></i>
                        </button>
                        <i class="fa-solid ${getSignalIconClass(s.type)}" style="color:${isOp ? 'var(--status-op)' : 'var(--status-av)'}"></i>
                        <h4>${s.code}</h4>
                    </div>
                    <div style="display: flex; gap: 4px; align-items: center;">
                        <span class="responsavel-badge ${respClass}">${s.responsavel || 'CHN-4'}</span>
                        <span class="badge ${isOp ? 'badge-op' : 'badge-av'}">${s.status}</span>
                    </div>
                </div>
                <div class="signal-card-body">
                    <strong>${s.name}</strong>
                    <div class="signal-char"><i class="fa-solid fa-lightbulb"></i> ${fullType} — ${s.characteristic}</div>
                </div>
                <div class="signal-meta">
                    <span>${toDMS(s.lat, true)} | ${toDMS(s.lng, false)}</span>
                    <span>Alcance: ${s.rangeNM} NM</span>
                </div>
            `;

            // Drag and Drop listeners on card
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', s.code);
                card.classList.add('dragging');
                const dropZone = document.getElementById('signalDropZone');
                if (dropZone) dropZone.classList.add('is-dragging-active');
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                const dropZone = document.getElementById('signalDropZone');
                if (dropZone) dropZone.classList.remove('is-dragging-active', 'drag-over');
            });

            card.addEventListener('click', () => {
                map.flyTo([s.lat, s.lng], 11, { duration: 1.2 });
                if (mapMarkers[s.code]) {
                    mapMarkers[s.code].openPopup();
                }
                openSignalDetail(s.code);
            });

            container.appendChild(card);
        });
    }

    function highlightSignalCard(code) {
        document.querySelectorAll('.signal-card').forEach(c => c.classList.remove('selected'));
        const card = document.getElementById(`card-${code}`);
        if (card) {
            card.classList.add('selected');
            card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    // =========================================================================
    // 9. DETALHES DO SINAL: EDICAO E GERENCIAMENTO
    // =========================================================================
    function sanitizeForDatabase(signal) {
        if (!signal) return null;
        return {
            code: String(signal.code || '').trim(),
            name: String(signal.name || '').trim(),
            type: String(signal.type || '').trim(),
            status: String(signal.status || '').trim(),
            lat: typeof signal.lat === 'number' ? signal.lat : parseFloat(signal.lat) || 0,
            lng: typeof signal.lng === 'number' ? signal.lng : parseFloat(signal.lng) || 0,
            characteristic: String(signal.characteristic || '').trim(),
            rangeNM: typeof signal.rangeNM === 'number' ? signal.rangeNM : parseFloat(signal.rangeNM) || 0,
            altitudeM: typeof signal.altitudeM === 'number' ? signal.altitudeM : parseFloat(signal.altitudeM) || 0,
            jurisdiction: String(signal.jurisdiction || 'CHN-4').trim(),
            responsavel: String(signal.responsavel || 'CHN-4').trim(),
            contingencyPlan: signal.contingencyPlan ? String(signal.contingencyPlan).trim() : (signal.planoContingencia ? String(signal.planoContingencia).trim() : ''),
            occurrenceStartDate: signal.occurrenceStartDate ? String(signal.occurrenceStartDate).trim() : (signal.inoperableSince ? String(signal.inoperableSince).trim() : null),
            inoperableSince: signal.inoperableSince ? String(signal.inoperableSince).trim() : (signal.occurrenceStartDate ? String(signal.occurrenceStartDate).trim() : null),
            image: signal.image || (Array.isArray(signal.images) && signal.images.length > 0 ? signal.images[0].url : null),
            photoDate: signal.photoDate || (Array.isArray(signal.images) && signal.images.length > 0 ? signal.images[0].date : null),
            images: Array.isArray(signal.images) ? signal.images.map(img => ({
                id: String(img.id || ''),
                url: String(img.url || ''),
                date: String(img.date || '')
            })) : (signal.image ? [{ id: 'img_0', url: String(signal.image), date: String(signal.photoDate || 'Sem data') }] : []),
            history: Array.isArray(signal.history) ? signal.history.map(h => ({
                date: String(h.date || ''),
                startDate: h.startDate ? String(h.startDate).trim() : null,
                status: String(h.status || ''),
                note: String(h.note || '')
            })) : []
        };
    }

    function saveSignalToBackend(signal) {
        const clean = sanitizeForDatabase(signal);
        if (!clean || !clean.code) return;

        const idx = signalsData.findIndex(s => s.code === clean.code);
        if (idx !== -1) {
            signalsData[idx] = clean;
        } else {
            signalsData.push(clean);
        }

        if (selectedSignal && selectedSignal.code === clean.code) {
            selectedSignal = clean;
        }

        // Modo Visualizador (Somente Leitura): gravações desativadas para proteção da nuvem
        saveLocalCache();
        console.log(`ℹ️ Modo Visualizador: Sinal ${clean.code} em modo somente leitura.`);
    }

    function updateIndividualSignalIEDisplay(signal) {
        if (!signal) return;
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;

        const inopData = computeSignalInoperableDays(signal, curYear, curMonth);
        const sigA_mes = inopData.a_mes;
        const sigA_ano = inopData.a_ano;

        // IE Individual NORMAM-601 Art. 2.49
        // Mensal: IE = [1 - (A / 30)] * 100
        // Anual (12 Últimos Meses Móveis): IE = [1 - (A / 360)] * 100
        const sigIeMesVal = Math.max(0, Math.min(100, (1 - (sigA_mes / 30)) * 100));
        const sigIeAnoVal = Math.max(0, Math.min(100, (1 - (sigA_ano / 360)) * 100));

        const sigIeMes = sigIeMesVal.toFixed(2).replace('.', ',');
        const sigIeAno = sigIeAnoVal.toFixed(2).replace('.', ',');

        const individualIeEl = document.getElementById('modalSpecIeIndividual');
        if (individualIeEl) {
            individualIeEl.textContent = `${sigIeMes}% (Mensal) | ${sigIeAno}% (12 Meses)`;
            individualIeEl.style.color = sigIeMesVal >= 95 ? 'var(--status-op)' : (sigIeMesVal >= 80 ? 'var(--accent-gold)' : 'var(--status-av)');
        }
    }

    function openSignalDetail(code) {
        const signal = signalsData.find(s => s.code === code);
        if (!signal) return;

        selectedSignal = signal;
        const modal = document.getElementById('modalSignalDetail');
        if (!modal) return;

        document.getElementById('modalSignalBadge').textContent = `DH2: ${signal.code}`;
        document.getElementById('modalSignalName').textContent = signal.name;

        // View Mode Specifications
        document.getElementById('modalSpecCode').textContent = signal.code;
        document.getElementById('modalSpecType').textContent = getFullTypeName(signal.type);
        document.getElementById('modalSpecPosDec').textContent = `${signal.lat.toFixed(5)}, ${signal.lng.toFixed(5)}`;
        document.getElementById('modalSpecPosGms').textContent = `${toDMS(signal.lat, true)} | ${toDMS(signal.lng, false)}`;
        document.getElementById('modalSpecChar').textContent = signal.characteristic;
        document.getElementById('modalSpecRange').textContent = `${signal.rangeNM} NM`;
        document.getElementById('modalSpecAltitude').textContent = `${signal.altitudeM} m`;
        document.getElementById('modalSpecJurisdiction').textContent = signal.jurisdiction || 'CHN-4';
        
        const specRespEl = document.getElementById('modalSpecResponsavel');
        if (specRespEl) specRespEl.textContent = signal.responsavel || 'CHN-4';

        const contPlanEl = document.getElementById('modalSpecContingencyPlan');
        if (contPlanEl) {
            contPlanEl.textContent = signal.contingencyPlan || signal.planoContingencia || 'Não informado';
        }

        const isOp = isOperational(signal.status);
        document.getElementById('modalSpecStatus').innerHTML = `<span class="badge ${isOp ? 'badge-op' : 'badge-av'}">${signal.status}</span>`;

        // Update Individual IE display
        updateIndividualSignalIEDisplay(signal);

        toggleEditSpecMode(false);
        currentPhotoIndex = 0;
        renderSignalPhoto(signal);

        const selectNewStatus = document.getElementById('selectNewStatus');
        if (selectNewStatus) selectNewStatus.value = isOp ? 'OPERACIONAL' : signal.status;
        const textOccurrenceReason = document.getElementById('textOccurrenceReason');
        if (textOccurrenceReason) textOccurrenceReason.value = '';

        const btnAvradio = document.getElementById('btnGenerateAvradioModal');
        if (btnAvradio) btnAvradio.style.display = isOp ? 'none' : 'inline-flex';

        // Initialize Direct Occurrence Date Input in Ficha DH2
        const directInput = document.getElementById('directOccurrenceDateInput');
        if (directInput) {
            let currentCompDate = signal.occurrenceStartDate || signal.inoperableSince;
            if (!currentCompDate && signal.history && signal.history.length > 0) {
                const inopHistory = signal.history.slice().reverse().find(h => !isOperational(h.status));
                if (inopHistory) {
                    currentCompDate = inopHistory.startDate || inopHistory.date;
                } else {
                    const lastEntry = signal.history[signal.history.length - 1];
                    currentCompDate = lastEntry.startDate || lastEntry.date;
                }
            }
            if (!currentCompDate) {
                const now = new Date();
                const pad = (n) => String(n).padStart(2, '0');
                currentCompDate = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
            } else {
                currentCompDate = currentCompDate.replace(' ', 'T').slice(0, 16);
            }
            directInput.value = currentCompDate;
        }

        renderHistoryTimeline(signal.history);
        modal.classList.add('active');
    }
    window.openSignalDetail = openSignalDetail;

    // Save Computation Date Button Click Handler (Dedicated Button)
    document.getElementById('btnSaveComputationDate')?.addEventListener('click', () => {
        if (!selectedSignal) return;
        const directInput = document.getElementById('directOccurrenceDateInput');
        const newVal = directInput?.value;
        if (!newVal) {
            showToast('Por favor, selecione uma data válida!', 'warning');
            return;
        }

        const formattedDate = newVal.replace('T', ' ');
        selectedSignal.occurrenceStartDate = formattedDate;
        selectedSignal.inoperableSince = formattedDate;

        if (!selectedSignal.history) selectedSignal.history = [];
        if (selectedSignal.history.length > 0) {
            selectedSignal.history[selectedSignal.history.length - 1].startDate = formattedDate;
        } else {
            selectedSignal.history.push({
                date: formattedDate,
                startDate: formattedDate,
                status: selectedSignal.status,
                note: 'Data inicial de cômputo ajustada.'
            });
        }

        // 1. Gravar no banco de dados e cache local
        saveSignalToBackend(selectedSignal);
        saveLocalCache();

        // 2. Recalcular IE geral (CHN-4)
        updateIE();

        // 3. Atualizar exibição de IE individual e histórico
        updateIndividualSignalIEDisplay(selectedSignal);
        renderHistoryTimeline(selectedSignal.history);

        const savedBadge = document.getElementById('savedIndicatorBadge');
        if (savedBadge) {
            savedBadge.style.display = 'block';
            setTimeout(() => { savedBadge.style.display = 'none'; }, 3500);
        }
        showToast(`Data inicial do sinal ${selectedSignal.code} gravada com sucesso! Novo IE recalculado.`, 'success');
    });

    // =========================================================================
    // MULTI-PHOTO GALLERY & LIGHTBOX SYSTEM
    // =========================================================================
    let currentPhotoIndex = 0;
    let lightboxZoom = 1;
    let lightboxPanX = 0;
    let lightboxPanY = 0;
    let isLightboxPanning = false;
    let lightboxStartX = 0;
    let lightboxStartY = 0;

    function getSignalImages(signal) {
        if (!signal) return [];
        if (Array.isArray(signal.images) && signal.images.length > 0) {
            return signal.images;
        }
        if (signal.image) {
            const dateStr = signal.photoDate || 'Sem data';
            signal.images = [{ id: 'img_0', url: signal.image, date: dateStr }];
            return signal.images;
        }
        signal.images = [];
        return signal.images;
    }

    function renderSignalPhoto(signal) {
        const placeholder = document.getElementById('photoPlaceholder');
        const imgWrapper = document.getElementById('photoImgWrapper');
        const imgDisplay = document.getElementById('signalImgDisplay');
        const infoBox = document.getElementById('photoInfoBox');
        const dateDisplay = document.getElementById('photoDateDisplay');
        const counterBadge = document.getElementById('photoCounterBadge');
        const prevBtn = document.getElementById('btnPhotoPrev');
        const nextBtn = document.getElementById('btnPhotoNext');
        const thumbStrip = document.getElementById('photoThumbStrip');

        if (!signal) return;
        const images = getSignalImages(signal);

        if (currentPhotoIndex >= images.length) {
            currentPhotoIndex = Math.max(0, images.length - 1);
        }

        if (images.length > 0) {
            const curImg = images[currentPhotoIndex];
            if (placeholder) placeholder.style.display = 'none';
            if (imgWrapper) imgWrapper.style.display = 'flex';
            if (imgDisplay) {
                imgDisplay.style.display = 'block';
                imgDisplay.src = curImg.url;
            }
            if (infoBox) infoBox.style.display = 'flex';
            if (dateDisplay) {
                dateDisplay.innerHTML = `<i class="fa-solid fa-calendar-day"></i> Foto: ${curImg.date || 'Sem data'}`;
            }

            if (counterBadge) {
                counterBadge.style.display = images.length > 1 ? 'inline-block' : 'none';
                counterBadge.textContent = `${currentPhotoIndex + 1} / ${images.length}`;
            }

            if (prevBtn) prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
            if (nextBtn) nextBtn.style.display = images.length > 1 ? 'flex' : 'none';

            // Render thumbnails in DH2
            if (thumbStrip) {
                if (images.length > 1) {
                    thumbStrip.style.display = 'flex';
                    thumbStrip.innerHTML = images.map((img, idx) => `
                        <img src="${img.url}" class="photo-thumb-item ${idx === currentPhotoIndex ? 'active' : ''}" 
                             onclick="window.selectSignalPhotoIndex(${idx})" alt="Miniatura ${idx + 1}" title="Foto ${idx + 1} (${img.date || ''})">
                    `).join('');
                } else {
                    thumbStrip.style.display = 'none';
                    thumbStrip.innerHTML = '';
                }
            }
        } else {
            if (placeholder) placeholder.style.display = 'flex';
            if (imgWrapper) imgWrapper.style.display = 'none';
            if (imgDisplay) imgDisplay.style.display = 'none';
            if (infoBox) infoBox.style.display = 'none';
            if (counterBadge) counterBadge.style.display = 'none';
            if (prevBtn) prevBtn.style.display = 'none';
            if (nextBtn) nextBtn.style.display = 'none';
            if (thumbStrip) {
                thumbStrip.style.display = 'none';
                thumbStrip.innerHTML = '';
            }
        }
    }

    window.selectSignalPhotoIndex = (index) => {
        if (!selectedSignal) return;
        const images = getSignalImages(selectedSignal);
        if (index >= 0 && index < images.length) {
            currentPhotoIndex = index;
            renderSignalPhoto(selectedSignal);
            if (document.getElementById('modalPhotoLightbox')?.classList.contains('active')) {
                updateLightboxPhotoView();
            }
        }
    };

    window.navigateSignalPhoto = (direction) => {
        if (!selectedSignal) return;
        const images = getSignalImages(selectedSignal);
        if (images.length <= 1) return;
        currentPhotoIndex = (currentPhotoIndex + direction + images.length) % images.length;
        renderSignalPhoto(selectedSignal);
        if (document.getElementById('modalPhotoLightbox')?.classList.contains('active')) {
            updateLightboxPhotoView();
        }
    };

    // Navigation buttons in DH2 Card
    document.getElementById('btnPhotoPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.navigateSignalPhoto(-1);
    });

    document.getElementById('btnPhotoNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.navigateSignalPhoto(1);
    });

    // Delete photo function (Desativado no Modo Visualizador)
    async function deleteCurrentSignalPhoto() {
        if (!selectedSignal) return;
        const images = getSignalImages(selectedSignal);
        if (images.length === 0) return;

        const currentNum = currentPhotoIndex + 1;
        const totalNum = images.length;
        if (!confirm(`Deseja realmente EXCLUIR a foto (${currentNum} de ${totalNum}) do sinal náutico [${selectedSignal.code}]?`)) {
            return;
        }

        // Remove photo at current index
        images.splice(currentPhotoIndex, 1);
        selectedSignal.images = images;

        if (images.length > 0) {
            if (currentPhotoIndex >= images.length) {
                currentPhotoIndex = images.length - 1;
            }
            selectedSignal.image = images[0].url;
            selectedSignal.photoDate = images[0].date;
        } else {
            currentPhotoIndex = 0;
            selectedSignal.image = null;
            selectedSignal.photoDate = null;
        }

        // Save to backend (IndexedDB, LocalStorage, Firestore, REST)
        saveSignalToBackend(selectedSignal);

        // Update UI
        renderSignalPhoto(selectedSignal);
        if (document.getElementById('modalPhotoLightbox')?.classList.contains('active')) {
            if (images.length > 0) {
                updateLightboxPhotoView();
            } else {
                document.getElementById('modalPhotoLightbox')?.classList.remove('active');
            }
        }

        showToast(`Foto ${currentNum} excluída com sucesso!`, 'success');
    }

    document.getElementById('btnDeleteCurrentPhoto')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCurrentSignalPhoto();
    });

    document.getElementById('btnLightboxDeletePhoto')?.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteCurrentSignalPhoto();
    });

    // =========================================================================
    // LIGHTBOX ZOOM & PAN SYSTEM
    // =========================================================================
    function updateLightboxTransform(smooth = true) {
        const img = document.getElementById('lightboxImg');
        const container = document.getElementById('lightboxImgContainer');
        const badge = document.getElementById('lightboxZoomLevel');
        if (!img) return;

        if (badge) badge.textContent = `${Math.round(lightboxZoom * 100)}%`;
        img.style.transition = smooth ? 'transform 0.12s cubic-bezier(0.16, 1, 0.3, 1)' : 'none';
        img.style.transform = `translate(${lightboxPanX}px, ${lightboxPanY}px) scale(${lightboxZoom})`;

        if (container) {
            if (lightboxZoom > 1.05) {
                container.classList.add('can-pan');
            } else {
                container.classList.remove('can-pan', 'panning');
                lightboxPanX = 0;
                lightboxPanY = 0;
            }
        }
    }

    function setLightboxZoom(newZoom, smooth = true) {
        lightboxZoom = Math.max(0.6, Math.min(newZoom, 6.0));
        if (lightboxZoom <= 1.05) {
            lightboxPanX = 0;
            lightboxPanY = 0;
        }
        updateLightboxTransform(smooth);
    }

    function resetLightboxZoom() {
        lightboxZoom = 1;
        lightboxPanX = 0;
        lightboxPanY = 0;
        updateLightboxTransform(true);
    }

    function updateLightboxPhotoView() {
        if (!selectedSignal) return;
        const images = getSignalImages(selectedSignal);
        if (images.length === 0) {
            document.getElementById('modalPhotoLightbox')?.classList.remove('active');
            return;
        }

        if (currentPhotoIndex >= images.length) {
            currentPhotoIndex = Math.max(0, images.length - 1);
        }

        const curImg = images[currentPhotoIndex];
        const img = document.getElementById('lightboxImg');
        const badge = document.getElementById('lightboxSignalBadge');
        const title = document.getElementById('lightboxSignalName');
        const counter = document.getElementById('lightboxPhotoCounter');
        const date = document.getElementById('lightboxPhotoDate');
        const btnDownload = document.getElementById('lightboxBtnDownload');
        const prevBtn = document.getElementById('btnLightboxPrev');
        const nextBtn = document.getElementById('btnLightboxNext');
        const thumbStrip = document.getElementById('lightboxThumbStrip');

        resetLightboxZoom();

        if (img) img.src = curImg.url;
        if (badge) badge.textContent = `DH2: ${selectedSignal.code || '--'}`;
        if (title) title.textContent = selectedSignal.name || 'Sinal Náutico';

        if (counter) {
            counter.style.display = images.length > 1 ? 'inline-block' : 'none';
            counter.textContent = `Foto ${currentPhotoIndex + 1} de ${images.length}`;
        }

        if (date) {
            date.innerHTML = `<i class="fa-solid fa-calendar-day"></i> ${curImg.date ? 'Foto de: ' + curImg.date : 'Sem data'}`;
        }

        if (btnDownload) {
            btnDownload.href = curImg.url;
            btnDownload.download = `DH2_${(selectedSignal.code || 'sinal').replace(/\s+/g, '_')}_foto_${currentPhotoIndex + 1}.jpg`;
        }

        if (prevBtn) prevBtn.style.display = images.length > 1 ? 'flex' : 'none';
        if (nextBtn) nextBtn.style.display = images.length > 1 ? 'flex' : 'none';

        if (thumbStrip) {
            if (images.length > 1) {
                thumbStrip.style.display = 'flex';
                thumbStrip.innerHTML = images.map((im, idx) => `
                    <img src="${im.url}" class="lightbox-thumb-item ${idx === currentPhotoIndex ? 'active' : ''}" 
                         onclick="window.selectSignalPhotoIndex(${idx})" alt="Foto ${idx + 1}" title="Foto ${idx + 1} (${im.date || ''})">
                `).join('');
            } else {
                thumbStrip.style.display = 'none';
                thumbStrip.innerHTML = '';
            }
        }
    }

    function openPhotoLightbox() {
        if (!selectedSignal) return;
        const images = getSignalImages(selectedSignal);
        if (images.length === 0) {
            showToast('Nenhuma foto anexada para expandir.', 'warning');
            return;
        }
        
        const modal = document.getElementById('modalPhotoLightbox');
        if (!modal) return;

        updateLightboxPhotoView();
        modal.classList.add('active');
    }

    // Lightbox Nav Arrows Click
    document.getElementById('btnLightboxPrev')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.navigateSignalPhoto(-1);
    });

    document.getElementById('btnLightboxNext')?.addEventListener('click', (e) => {
        e.stopPropagation();
        window.navigateSignalPhoto(1);
    });

    // Zoom Controls Events
    document.getElementById('btnLightboxZoomIn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        setLightboxZoom(lightboxZoom + 0.35);
    });

    document.getElementById('btnLightboxZoomOut')?.addEventListener('click', (e) => {
        e.stopPropagation();
        setLightboxZoom(lightboxZoom - 0.35);
    });

    document.getElementById('btnLightboxResetZoom')?.addEventListener('click', (e) => {
        e.stopPropagation();
        resetLightboxZoom();
    });

    // Wheel Zoom on Lightbox Body / Container
    const lightboxBodyEl = document.getElementById('lightboxBody');
    lightboxBodyEl?.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.25 : -0.25;
        setLightboxZoom(lightboxZoom + delta, false);
    }, { passive: false });

    // Double Click to Toggle 2x Zoom
    const lightboxImgEl = document.getElementById('lightboxImg');
    lightboxImgEl?.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (lightboxZoom > 1.2) {
            resetLightboxZoom();
        } else {
            setLightboxZoom(2.2);
        }
    });

    // Drag to Pan when Zoomed
    const lightboxImgContainerEl = document.getElementById('lightboxImgContainer');
    lightboxImgContainerEl?.addEventListener('mousedown', (e) => {
        if (lightboxZoom <= 1.05) return;
        isLightboxPanning = true;
        lightboxStartX = e.clientX - lightboxPanX;
        lightboxStartY = e.clientY - lightboxPanY;
        lightboxImgContainerEl.classList.add('panning');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isLightboxPanning) return;
        lightboxPanX = e.clientX - lightboxStartX;
        lightboxPanY = e.clientY - lightboxStartY;
        updateLightboxTransform(false);
    });

    window.addEventListener('mouseup', () => {
        if (isLightboxPanning) {
            isLightboxPanning = false;
            document.getElementById('lightboxImgContainer')?.classList.remove('panning');
        }
    });

    // Keyboard navigation when Lightbox is active
    window.addEventListener('keydown', (e) => {
        const lightboxModal = document.getElementById('modalPhotoLightbox');
        if (!lightboxModal || !lightboxModal.classList.contains('active')) return;

        if (e.key === 'ArrowLeft') {
            e.preventDefault();
            window.navigateSignalPhoto(-1);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            window.navigateSignalPhoto(1);
        }
    });

    // Bind click to expand photo in DH2
    document.getElementById('signalImgDisplay')?.addEventListener('click', openPhotoLightbox);
    document.getElementById('photoImgWrapper')?.addEventListener('click', openPhotoLightbox);
    document.getElementById('btnExpandPhotoDetail')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openPhotoLightbox();
    });

    function toggleEditSpecMode(enable) {
        const viewMode = document.getElementById('viewSpecMode');
        const editForm = document.getElementById('formEditSpec');
        const textBtn = document.getElementById('textBtnEdit');

        if (enable && selectedSignal && editForm) {
            if (viewMode) viewMode.style.display = 'none';
            editForm.style.display = 'block';
            if (textBtn) textBtn.textContent = 'Cancelar Edição';

            if (document.getElementById('editCode')) document.getElementById('editCode').value = selectedSignal.code;
            if (document.getElementById('editName')) document.getElementById('editName').value = selectedSignal.name;
            if (document.getElementById('editType')) document.getElementById('editType').value = selectedSignal.type;
            if (document.getElementById('editCharacteristic')) document.getElementById('editCharacteristic').value = selectedSignal.characteristic;
            if (document.getElementById('editRange')) document.getElementById('editRange').value = selectedSignal.rangeNM;
            if (document.getElementById('editAltitude')) document.getElementById('editAltitude').value = selectedSignal.altitudeM;
            if (document.getElementById('editLat')) document.getElementById('editLat').value = selectedSignal.lat;
            if (document.getElementById('editLng')) document.getElementById('editLng').value = selectedSignal.lng;
            if (document.getElementById('editJurisdiction')) document.getElementById('editJurisdiction').value = selectedSignal.jurisdiction || 'CHN-4';
            
            const latDDM = decimalToDDM(selectedSignal.lat, true);
            const lngDDM = decimalToDDM(selectedSignal.lng, false);
            if (document.getElementById('editLatDeg')) document.getElementById('editLatDeg').value = latDDM.deg;
            if (document.getElementById('editLatMin')) document.getElementById('editLatMin').value = latDDM.min;
            if (document.getElementById('editLatHem')) document.getElementById('editLatHem').value = latDDM.hem;
            if (document.getElementById('editLngDeg')) document.getElementById('editLngDeg').value = lngDDM.deg;
            if (document.getElementById('editLngMin')) document.getElementById('editLngMin').value = lngDDM.min;
            if (document.getElementById('editLngHem')) document.getElementById('editLngHem').value = lngDDM.hem;

            document.getElementById('btnEditCoordModeGMS')?.classList.add('active');
            document.getElementById('btnEditCoordModeDecimal')?.classList.remove('active');
            if (document.getElementById('panelEditCoordGMS')) document.getElementById('panelEditCoordGMS').style.display = 'block';
            if (document.getElementById('panelEditCoordDecimal')) document.getElementById('panelEditCoordDecimal').style.display = 'none';
            if (document.getElementById('editLatDeg')) document.getElementById('editLatDeg').required = true;
            if (document.getElementById('editLngDeg')) document.getElementById('editLngDeg').required = true;
            if (document.getElementById('editLat')) document.getElementById('editLat').required = false;
            if (document.getElementById('editLng')) document.getElementById('editLng').required = false;

            const editRespEl = document.getElementById('editResponsavel');
            if (editRespEl) editRespEl.value = selectedSignal.responsavel || 'CHN-4';

            const editContPlanEl = document.getElementById('editContingencyPlan');
            if (editContPlanEl) editContPlanEl.value = selectedSignal.contingencyPlan || selectedSignal.planoContingencia || '';
        } else {
            if (viewMode) viewMode.style.display = 'block';
            if (editForm) editForm.style.display = 'none';
            if (textBtn) textBtn.textContent = 'Editar Ficha Técnica';
        }
    }

    document.getElementById('btnToggleEditMode')?.addEventListener('click', () => {
        const editForm = document.getElementById('formEditSpec');
        const isEditing = editForm.style.display === 'block';
        toggleEditSpecMode(!isEditing);
    });

    // Save Technical Specification Edit
    document.getElementById('formEditSpec')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!selectedSignal) return;

        const oldCode = selectedSignal.code;
        const newCode = document.getElementById('editCode').value.trim();
        const newName = document.getElementById('editName').value.trim();
        const newType = document.getElementById('editType').value.trim();
        const newChar = document.getElementById('editCharacteristic').value.trim();
        const newRange = parseFloat(document.getElementById('editRange').value) || 0;
        const newAlt = parseFloat(document.getElementById('editAltitude').value) || 0;
        
        let newLat = parseFloat(document.getElementById('editLat')?.value);
        let newLng = parseFloat(document.getElementById('editLng')?.value);

        const isGmsActive = document.getElementById('btnEditCoordModeGMS')?.classList.contains('active');
        if (isGmsActive) {
            const latDeg = document.getElementById('editLatDeg')?.value;
            const latMin = document.getElementById('editLatMin')?.value;
            const latHem = document.getElementById('editLatHem')?.value;
            const lngDeg = document.getElementById('editLngDeg')?.value;
            const lngMin = document.getElementById('editLngMin')?.value;
            const lngHem = document.getElementById('editLngHem')?.value;

            if (latDeg !== '' && latMin !== '') {
                newLat = ddmToDecimal(latDeg, latMin, latHem);
            }
            if (lngDeg !== '' && lngMin !== '') {
                newLng = ddmToDecimal(lngDeg, lngMin, lngHem);
            }
        }

        if (isNaN(newLat)) newLat = selectedSignal.lat;
        if (isNaN(newLng)) newLng = selectedSignal.lng;

        const newJur = document.getElementById('editJurisdiction').value.trim();
        const newResp = document.getElementById('editResponsavel')?.value || selectedSignal.responsavel || 'CHN-4';
        const newContPlan = document.getElementById('editContingencyPlan')?.value?.trim() || '';

        // 1. Em modo visualizador, exclusões na nuvem são bloqueadas
        if (oldCode && oldCode !== newCode) {
            signalsData = signalsData.filter(s => s.code !== oldCode);
        }

        // 2. Update object fields
        selectedSignal.code = newCode;
        selectedSignal.name = newName;
        selectedSignal.type = newType;
        selectedSignal.characteristic = newChar;
        selectedSignal.rangeNM = newRange;
        selectedSignal.altitudeM = newAlt;
        selectedSignal.lat = newLat;
        selectedSignal.lng = newLng;
        selectedSignal.jurisdiction = newJur;
        selectedSignal.responsavel = newResp;
        selectedSignal.contingencyPlan = newContPlan;

        // 3. Save to backend (Cloud Firestore + REST API / signals.json)
        saveSignalToBackend(selectedSignal);

        // 4. Update UI in real-time "in hot"
        toggleEditSpecMode(false);
        openSignalDetail(selectedSignal.code);
        saveLocalCache();
        updateTypeFilterDropdown();
        updateIE();
        renderMapMarkers();
        renderSignalList();

        showToast(`Ficha Técnica do sinal ${newCode} salva com sucesso no banco de dados!`, 'success');
    });

    // Delete Signal Function (Desativado no Modo Visualizador)
    async function deleteSignalPermanently(code, name) {
        showToast('Modo Visualizador: Exclusão de sinais desativada.', 'warning');
        return;
    }

    window.deleteSignalFromCard = (code, name) => {
        deleteSignalPermanently(code, name);
    };

    // Delete Button in Signal Detail Modal
    document.getElementById('btnDeleteSignal')?.addEventListener('click', () => {
        if (!selectedSignal) return;
        deleteSignalPermanently(selectedSignal.code, selectedSignal.name);
    });

    // Attach/Upload Signal Photo Listener
    const inputPhotoFile = document.getElementById('inputPhotoFile');
    document.getElementById('btnTriggerPhotoUpload')?.addEventListener('click', () => inputPhotoFile?.click());

    inputPhotoFile?.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0 || !selectedSignal) return;

        showToast(`Processando ${files.length} foto(s) para a galeria do sinal...`, 'info');

        try {
            const images = getSignalImages(selectedSignal);
            const now = new Date();
            const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

            let addedCount = 0;
            for (const file of files) {
                const optimizedBase64 = await optimizeImage(file, 1280, 1280, 0.82);
                if (optimizedBase64) {
                    images.push({
                        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        url: optimizedBase64,
                        date: dateStr
                    });
                    addedCount++;
                }
            }

            if (addedCount > 0) {
                selectedSignal.images = images;
                selectedSignal.image = images[images.length - 1].url;
                selectedSignal.photoDate = images[images.length - 1].date;
                currentPhotoIndex = images.length - 1; // View the newest added photo

                // Salva na memória, Firestore, LocalStorage, IndexedDB e REST API
                saveSignalToBackend(selectedSignal);

                // Atualiza a interface gráfica imediatamente
                renderSignalPhoto(selectedSignal);
                if (document.getElementById('modalPhotoLightbox')?.classList.contains('active')) {
                    updateLightboxPhotoView();
                }

                showToast(`${addedCount} foto(s) adicionada(s) à galeria do sinal ${selectedSignal.code}!`, 'success');
            } else {
                showToast('Nenhuma imagem pôde ser processada.', 'warning');
            }
        } catch (err) {
            console.error('Erro ao processar imagem(ns):', err);
            showToast('Erro ao processar a(s) imagem(ns) anexada(s).', 'danger');
        } finally {
            inputPhotoFile.value = '';
        }
    });

    function renderHistoryTimeline(history) {
        const container = document.getElementById('modalHistoryTimeline');
        if (!container) return;
        container.innerHTML = '';

        if (!history || history.length === 0) {
            container.innerHTML = '<div class="text-muted">Nenhum registro anterior.</div>';
            return;
        }

        history.slice().reverse().forEach(h => {
            const isOp = isOperational(h.status);
            const item = document.createElement('div');
            item.className = `timeline-item ${isOp ? 'status-op' : 'status-av'}`;
            const startLabel = h.startDate ? ` <span style="font-size: 0.72rem; color: var(--accent-gold);">(Início: ${h.startDate})</span>` : '';
            item.innerHTML = `
                <div class="timeline-date">${h.date}${startLabel} — <strong>${h.status}</strong></div>
                <div class="timeline-reason">${h.note}</div>
            `;
            container.appendChild(item);
        });
    }

    document.getElementById('formUpdateStatus')?.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!selectedSignal) return;

        const newStatus = document.getElementById('selectNewStatus').value;
        const reason = document.getElementById('textOccurrenceReason').value.trim();
        const directDateVal = document.getElementById('directOccurrenceDateInput')?.value;

        if (!reason) {
            showToast('O campo de formalização da ocorrência é obrigatório!', 'danger');
            return;
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const initialDateStr = directDateVal ? directDateVal.replace('T', ' ') : dateStr;

        selectedSignal.status = newStatus;
        if (!selectedSignal.history) selectedSignal.history = [];
        selectedSignal.history.push({
            date: dateStr,
            startDate: initialDateStr,
            status: newStatus,
            note: reason
        });

        // Immediate Ficha DH2 close & real-time "in hot" UI update
        const modalDetail = document.getElementById('modalSignalDetail');
        if (modalDetail) modalDetail.classList.remove('active');

        saveSignalToBackend(selectedSignal);

        saveLocalCache();
        updateTypeFilterDropdown();
        updateIE();
        renderMapMarkers();
        renderSignalList();

        showToast(`Status do sinal ${selectedSignal.code} atualizado com sucesso!`, 'success');

        // Automatically open AVRADIO modal if status is damaged/inoperable
        if (!isOperational(newStatus)) {
            setTimeout(() => {
                generateAVRADIO(selectedSignal, reason);
            }, 120);
        }
    });

    // =========================================================================
    // 10. EMISSÃO DE AVRADIO (NORMAM-601/DHN)
    // =========================================================================
    function generateAVRADIO(signal, occurrenceReason = '') {
        const modal = document.getElementById('modalAvradio');
        const textarea = document.getElementById('avradioTextarea');
        if (!modal || !textarea) return;

        const statusReason = occurrenceReason || (signal.history.length > 0 ? signal.history[signal.history.length - 1].note : signal.status);
        const timestampZ = getFormattedTimestampZ();
        const posGMS = `${toDMS(signal.lat, true)} / ${toDMS(signal.lng, false)}`;

        const avradioText = 
`ASSUNTO: AVRADIO - ${signal.name.toUpperCase()} - ${signal.status.toUpperCase()}
UNO - ${signal.code} - ${signal.name.toUpperCase()}
DOIS - IDENTIFICAÇÃO DO SINAL NÁUTICO: ${signal.characteristic.toUpperCase()} E COORDENADA DA POSIÇÃO: ${posGMS}
TRÊS - SITUAÇÃO: ${signal.status.toUpperCase()} (${statusReason.toUpperCase()}) EM ${timestampZ}
QUATRO - NAVEGANTES DEVEM NAVEGAR COM CAUTELA NA ÁREA.`;

        textarea.value = avradioText;
        modal.classList.add('active');
    }

    document.getElementById('btnCopyAvradio')?.addEventListener('click', () => {
        const textarea = document.getElementById('avradioTextarea');
        if (!textarea) return;
        textarea.select();
        navigator.clipboard.writeText(textarea.value).then(() => {
            showToast('Texto da Minuta AVRADIO copiado com sucesso!', 'success');
        });
    });

    document.getElementById('btnDownloadAvradio')?.addEventListener('click', () => {
        const text = document.getElementById('avradioTextarea').value;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `AVRADIO_${selectedSignal ? selectedSignal.code : 'DHN'}.txt`;
        link.click();
    });

    // =========================================================================
    // 11. TRAÇADO DE DERROTA NÁUTICA INTERATIVA (CANAL SEGURO)
    // =========================================================================
    function toggleDrawDerrotaMode() {
        if (isDrawDerrotaMode) {
            stopDrawDerrotaMode();
        } else {
            startDrawDerrotaMode();
        }
    }

    function startDrawDerrotaMode() {
        isDrawDerrotaMode = true;
        isRouteVisible = true;
        const btnText = document.getElementById('btnDrawDerrotaText');
        const btn = document.getElementById('btnToggleDrawDerrota');
        if (btnText) btnText.textContent = 'Finalizar Traçado';
        if (btn) btn.classList.add('active');

        map.getContainer().style.cursor = 'crosshair';
        map.doubleClickZoom.disable();

        // Attach listeners for interactive drawing
        map.on('click', onRouteMapClick);
        map.on('mousemove', onRouteMouseMove);
        map.on('dblclick', onRouteMapDblClick);

        showToast(routeWaypoints.length === 0
            ? 'Derrota Náutica: Clique no mapa para marcar o Ponto de Partida.'
            : 'Derrota Náutica: Clique no mapa para adicionar o próximo Waypoint.', 'info');
    }

    function stopDrawDerrotaMode() {
        isDrawDerrotaMode = false;
        const btnText = document.getElementById('btnDrawDerrotaText');
        const btn = document.getElementById('btnToggleDrawDerrota');
        if (btnText) btnText.textContent = 'Traçar no Mapa';
        if (btn) btn.classList.remove('active');

        if (routeDynamicLine) {
            routeLayerGroup.removeLayer(routeDynamicLine);
            routeDynamicLine = null;
        }
        if (routeTooltip) {
            map.removeLayer(routeTooltip);
            routeTooltip = null;
        }

        map.getContainer().style.cursor = '';
        map.doubleClickZoom.enable();

        map.off('click', onRouteMapClick);
        map.off('mousemove', onRouteMouseMove);
        map.off('dblclick', onRouteMapDblClick);

        updateRoute();
    }

    function onRouteMouseMove(e) {
        if (!isDrawDerrotaMode) return;
        if (routeWaypoints.length === 0) return;

        const pLast = routeWaypoints[routeWaypoints.length - 1];
        const pCurrent = e.latlng;

        const segNM = haversineNM(pLast.lat, pLast.lng, pCurrent.lat, pCurrent.lng);
        const segBearing = calculateBearing(pLast.lat, pLast.lng, pCurrent.lat, pCurrent.lng);
        const segFormat = formatDistanceMetricAndNautical(segNM);

        let totalNM = 0;
        for (let i = 0; i < routeWaypoints.length - 1; i++) {
            totalNM += haversineNM(routeWaypoints[i].lat, routeWaypoints[i].lng, routeWaypoints[i+1].lat, routeWaypoints[i+1].lng);
        }
        totalNM += segNM;

        if (!routeDynamicLine) {
            routeDynamicLine = L.polyline([[pLast.lat, pLast.lng], pCurrent], {
                color: '#f59e0b',
                weight: 4,
                dashArray: '8, 8',
                opacity: 0.9
            }).addTo(routeLayerGroup);
        } else {
            routeDynamicLine.setLatLngs([[pLast.lat, pLast.lng], pCurrent]);
        }

        const nextLegNum = routeWaypoints.length;
        const tooltipHtml = `
            <div>
                <strong>Perna ${nextLegNum}:</strong> ${segFormat.nmStr} <span style="color:#93c5fd;">(${segFormat.metricStr})</span>
            </div>
            <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 2px;">
                Rumo: <strong>${segBearing}°</strong> | Derrota Total: <strong>${totalNM.toFixed(1)} NM</strong>
            </div>
        `;

        if (!routeTooltip) {
            routeTooltip = L.tooltip({
                permanent: true,
                direction: 'top',
                offset: [0, -14],
                className: 'measure-live-tooltip'
            }).setLatLng(pCurrent).setContent(tooltipHtml).addTo(map);
        } else {
            routeTooltip.setLatLng(pCurrent).setContent(tooltipHtml);
        }
    }

    function onRouteMapClick(e) {
        if (!isDrawDerrotaMode) return;

        const newPoint = e.latlng;
        const idx = routeWaypoints.length;
        const wpName = idx === 0 ? 'Ponto de Partida' : `Waypoint ${idx}`;

        routeWaypoints.push({
            id: `wpt_${Date.now()}_${idx}`,
            name: wpName,
            lat: newPoint.lat,
            lng: newPoint.lng
        });

        isRouteVisible = true;
        updateRoute();

        if (idx === 0) {
            showToast('Partida definida! Mova o mouse e clique para adicionar os Pontos de Guinada.', 'success');
        } else {
            showToast(`Waypoint ${idx} adicionado à derrota.`, 'info');
        }
    }

    function onRouteMapDblClick(e) {
        if (!isDrawDerrotaMode) return;
        L.DomEvent.stop(e);
        stopDrawDerrotaMode();
        showToast('Traçado de derrota finalizado.', 'success');
    }

    function updateRoute() {
        routeLayerGroup.clearLayers();
        waypointMarkers = [];

        if (!isRouteVisible || routeWaypoints.length === 0) {
            renderWaypointsList(routeWaypoints);
            calculateRouteTelemetry(routeWaypoints);
            return;
        }

        const latLngs = routeWaypoints.map(wp => [wp.lat, wp.lng]);

        // Draw Nautical Channel Line
        if (latLngs.length >= 2) {
            routePolyline = L.polyline(latLngs, {
                color: '#f59e0b',
                weight: 4,
                dashArray: '8, 8',
                lineJoin: 'round'
            }).addTo(routeLayerGroup);

            // Add midpoint badges for each leg
            for (let i = 0; i < routeWaypoints.length - 1; i++) {
                const p1 = routeWaypoints[i];
                const p2 = routeWaypoints[i + 1];
                const distNM = haversineNM(p1.lat, p1.lng, p2.lat, p2.lng);
                const bearing = calculateBearing(p1.lat, p1.lng, p2.lat, p2.lng);
                const distFormat = formatDistanceMetricAndNautical(distNM);

                const midLat = (p1.lat + p2.lat) / 2;
                const midLng = (p1.lng + p2.lng) / 2;

                const badgeIcon = L.divIcon({
                    className: 'measure-badge-wrapper',
                    html: `<div class="route-leg-badge"><span>Perna ${i + 1}: ${distFormat.nmStr}</span> <small>(${distFormat.metricStr}) • ${bearing}°</small></div>`,
                    iconSize: [200, 24],
                    iconAnchor: [100, 12]
                });

                L.marker([midLat, midLng], { icon: badgeIcon, interactive: false }).addTo(routeLayerGroup);
            }
        }

        // Place Draggable Waypoint Markers
        routeWaypoints.forEach((wp, index) => {
            const isFirst = index === 0;
            const isLast = index === routeWaypoints.length - 1 && routeWaypoints.length > 1;
            let colorClass = 'wp-waypoint';
            if (isFirst) colorClass = 'wp-base';
            else if (isLast) colorClass = 'wp-destination';

            const labelText = isFirst ? 'P' : (isLast ? 'D' : index);

            const icon = L.divIcon({
                className: 'custom-wp-icon-wrapper',
                html: `<div class="wp-marker ${colorClass}" title="${wp.name}"><span>${labelText}</span></div>`,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const marker = L.marker([wp.lat, wp.lng], {
                icon: icon,
                draggable: true
            }).addTo(routeLayerGroup);

            marker.on('dragend', (e) => {
                const newPos = e.target.getLatLng();
                routeWaypoints[index].lat = newPos.lat;
                routeWaypoints[index].lng = newPos.lng;
                updateRoute();
            });

            waypointMarkers.push(marker);
        });

        renderWaypointsList(routeWaypoints);
        calculateRouteTelemetry(routeWaypoints);
    }

    function calculateRouteTelemetry(sequence) {
        let totalDistance = 0;
        for (let i = 0; i < sequence.length - 1; i++) {
            totalDistance += haversineNM(
                sequence[i].lat, sequence[i].lng,
                sequence[i+1].lat, sequence[i+1].lng
            );
        }

        const speedInput = document.getElementById('shipSpeedInput');
        const speed = speedInput ? parseFloat(speedInput.value) || 10 : 10;
        const totalHours = speed > 0 ? totalDistance / speed : 0;
        const hours = Math.floor(totalHours);
        const minutes = Math.round((totalHours - hours) * 60);

        const distFormat = formatDistanceMetricAndNautical(totalDistance);

        const distEl = document.getElementById('routeDistanceVal');
        const countEl = document.getElementById('routeWaypointsCount');
        const etaEl = document.getElementById('routeEtaVal');

        if (distEl) distEl.innerHTML = `${distFormat.nmStr} <small style="font-size:0.75rem; color:#38bdf8;">(${distFormat.metricStr})</small>`;
        if (countEl) countEl.innerHTML = `${sequence.length} <small>pts</small>`;
        if (etaEl) etaEl.textContent = `${hours}h ${String(minutes).padStart(2, '0')}m`;
    }

    function renderWaypointsList(sequence) {
        const container = document.getElementById('waypointsList');
        if (!container) return;
        container.innerHTML = '';

        if (sequence.length === 0) {
            container.innerHTML = '<li class="waypoint-item empty" style="color:var(--text-muted); text-align:center; padding:12px;">Nenhum ponto traçado. Clique em "Traçar no Mapa" para começar.</li>';
            return;
        }

        for (let i = 0; i < sequence.length; i++) {
            const wp = sequence[i];
            const li = document.createElement('li');
            li.className = 'waypoint-item';

            let legInfo = 'Origem / Ponto de Partida';
            if (i > 0) {
                const prev = sequence[i - 1];
                const dist = haversineNM(prev.lat, prev.lng, wp.lat, wp.lng);
                const bearing = calculateBearing(prev.lat, prev.lng, wp.lat, wp.lng);
                const distFormat = formatDistanceMetricAndNautical(dist);
                legInfo = `Perna ${i}: ${distFormat.nmStr} (${distFormat.metricStr}) • Rumo ${bearing}°`;
            }

            const isStart = i === 0;
            const isEnd = i === sequence.length - 1 && sequence.length > 1;
            const badgeLabel = isStart ? 'PARTIDA' : (isEnd ? 'DESTINO' : `WPT ${i}`);

            li.innerHTML = `
                <div class="wp-item-head">
                    <span class="wp-num" style="background:${isStart ? 'var(--accent-gold)' : (isEnd ? 'var(--status-op)' : 'var(--navy-700)')}; color:${isStart ? '#0f172a' : '#ffffff'};">${badgeLabel}</span>
                    <strong style="color:#ffffff; cursor:pointer;" onclick="window.focusWaypoint(${i})">${wp.name}</strong>
                    <button class="btn-remove-wp" onclick="window.removeWaypoint(${i})" title="Remover este ponto">&times;</button>
                </div>
                <div class="wp-item-meta">${legInfo}</div>
                <div class="wp-coords">${toDMS(wp.lat, true)} | ${toDMS(wp.lng, false)}</div>
            `;
            container.appendChild(li);
        }
    }

    window.removeWaypoint = (index) => {
        routeWaypoints.splice(index, 1);
        updateRoute();
        showToast('Ponto removido da derrota.', 'info');
    };

    window.focusWaypoint = (index) => {
        if (routeWaypoints[index]) {
            const wp = routeWaypoints[index];
            map.flyTo([wp.lat, wp.lng], 13, { duration: 1.0 });
        }
    };

    window.addSignalToRoute = (code) => {
        const signal = signalsData.find(s => s.code === code);
        if (!signal) return;

        routeWaypoints.push({
            id: `sig_${signal.code}`,
            name: `${signal.code} - ${signal.name}`,
            lat: signal.lat,
            lng: signal.lng
        });

        isRouteVisible = true;
        updateRoute();
        showToast(`Sinal ${signal.code} adicionado à derrota náutica!`, 'success');
    };

    // Route Buttons Listeners
    document.getElementById('btnToggleDrawDerrota')?.addEventListener('click', toggleDrawDerrotaMode);

    document.getElementById('btnToggleRouteVisibility')?.addEventListener('click', () => {
        isRouteVisible = !isRouteVisible;
        const textEl = document.getElementById('btnRouteVisText');
        if (textEl) textEl.textContent = isRouteVisible ? 'Ocultar Derrota' : 'Exibir Derrota';
        updateRoute();
        showToast(isRouteVisible ? 'Derrota exibida no mapa.' : 'Derrota ocultada do mapa.', 'info');
    });

    document.getElementById('btnClearRoute')?.addEventListener('click', () => {
        if (routeWaypoints.length === 0) return;
        if (confirm('Deseja limpar todos os pontos da derrota náutica?')) {
            routeWaypoints = [];
            if (isDrawDerrotaMode) stopDrawDerrotaMode();
            updateRoute();
            showToast('Derrota náutica limpa com sucesso.', 'info');
        }
    });

    document.getElementById('btnOpenGoogleMapsRoute')?.addEventListener('click', () => {
        if (routeWaypoints.length < 2) {
            showToast('Trace pelo menos 2 pontos de derrota para abrir no Google Maps.', 'warning');
            return;
        }
        const coords = routeWaypoints.map(wp => `${wp.lat.toFixed(6)},${wp.lng.toFixed(6)}`).join('/');
        window.open(`https://www.google.com/maps/dir/${coords}`, '_blank');
    });

    document.getElementById('shipSpeedInput')?.addEventListener('input', () => {
        calculateRouteTelemetry(routeWaypoints);
    });

    // =========================================================================
    // 12. CONTROLES DE INTERFACE & FILTROS
    // =========================================================================
    // Alternância de Abas da Barra Lateral (Sinais, Derrota, IE & Stats)
    document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = btn.getAttribute('data-tab');
            if (!tabId) return;

            document.querySelectorAll('.sidebar-tabs .tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.app-sidebar .tab-content').forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetContent = document.getElementById(tabId);
            if (targetContent) {
                targetContent.classList.add('active');
            }

            if (tabId === 'tab-ie') {
                updateIE();
            } else if (tabId === 'tab-route') {
                updateRoute();
            }
        });
    });

    const searchInput = document.getElementById('searchInput');
    searchInput?.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderSignalList();
        if (selectedSignalCodes.size === 0) {
            renderMapMarkers();
        }
    });

    document.getElementById('btnClearSearch')?.addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        currentSearch = '';
        renderSignalList();
        if (selectedSignalCodes.size === 0) {
            renderMapMarkers();
        }
    });

    document.querySelectorAll('.pill-btn').forEach(pill => {
        pill.addEventListener('click', () => {
            document.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            currentFilter = pill.getAttribute('data-filter');
            renderSignalList();
            renderMapMarkers();
        });
    });

    // Tray & Quick Reset Handlers
    document.getElementById('btnResetToCHN4Default')?.addEventListener('click', restoreDefaultCHN4View);
    document.getElementById('btnQuickResetCHN4')?.addEventListener('click', restoreDefaultCHN4View);
    document.getElementById('btnFitSelected')?.addEventListener('click', fitSelectedSignals);

    // Drag and Drop Zone Event Listeners
    const setupDropZone = (element) => {
        if (!element) return;
        element.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            element.classList.add('drag-over');
        });
        element.addEventListener('dragleave', () => {
            element.classList.remove('drag-over');
        });
        element.addEventListener('drop', (e) => {
            e.preventDefault();
            element.classList.remove('drag-over');
            const code = e.dataTransfer.getData('text/plain');
            if (code) {
                window.toggleSelectSignal(code, true);
            }
            document.getElementById('signalDropZone')?.classList.remove('is-dragging-active');
        });
    };

    setupDropZone(document.getElementById('signalDropZone'));
    setupDropZone(document.getElementById('selectedSignalsTray'));

    const typeFilterSelect = document.getElementById('typeFilterSelect');
    typeFilterSelect?.addEventListener('change', (e) => {
        currentTypeFilter = e.target.value;
        renderSignalList();
        renderMapMarkers();
    });

    const responsavelFilterSelect = document.getElementById('responsavelFilterSelect');
    responsavelFilterSelect?.addEventListener('change', (e) => {
        currentResponsavelFilter = e.target.value;
        renderSignalList();
        renderMapMarkers();
    });

    document.getElementById('btnCenterAll')?.addEventListener('click', () => {
        if (signalsData.length === 0) return;
        const bounds = L.latLngBounds(signalsData.map(s => [s.lat, s.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
    });

    // =========================================================================
    // MODO MEDIÇÃO DE DISTÂNCIA INTERATIVA (RÉGUA NÁUTICA COM NM & METROS)
    // =========================================================================
    function formatDistanceMetricAndNautical(nm) {
        const meters = nm * 1852;
        let metricStr = '';
        if (meters < 1000) {
            metricStr = `${Math.round(meters)} m`;
        } else {
            metricStr = `${(meters / 1000).toFixed(2)} km`;
        }
        const nmStr = `${nm.toFixed(2)} NM`;
        return { nmStr, metricStr, meters, fullStr: `${nmStr} (${metricStr})` };
    }

    function toggleMeasureMode() {
        if (isMeasureMode) {
            stopMeasureMode();
        } else {
            startMeasureMode();
        }
    }

    function startMeasureMode() {
        if (isPinInspectMode) {
            stopPinInspectMode();
        }
        isMeasureMode = true;
        document.getElementById('btnToggleMeasure')?.classList.add('active');
        map.getContainer().style.cursor = 'crosshair';
        map.doubleClickZoom.disable();

        // Create / show floating measurement HUD
        let hud = document.getElementById('measureHud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'measureHud';
            hud.className = 'measure-hud';
            hud.innerHTML = `
                <div class="measure-hud-info">
                    <i class="fa-solid fa-ruler-combined text-gold"></i>
                    <span id="measureHudText">Clique no mapa para marcar o 1º ponto de medição.</span>
                </div>
                <div class="measure-hud-actions">
                    <button type="button" class="btn-measure-hud" id="btnMeasureClear" title="Limpar traçado de medição"><i class="fa-solid fa-trash-can"></i> Limpar</button>
                    <button type="button" class="btn-measure-hud btn-measure-close" id="btnMeasureClose" title="Sair do modo medição"><i class="fa-solid fa-xmark"></i> Sair</button>
                </div>
            `;
            document.querySelector('.app-map-wrapper')?.appendChild(hud);

            document.getElementById('btnMeasureClear')?.addEventListener('click', clearMeasureData);
            document.getElementById('btnMeasureClose')?.addEventListener('click', stopMeasureMode);
        } else {
            hud.style.display = 'flex';
            updateMeasureHudText('Clique no mapa para marcar o 1º ponto de medição.');
        }

        map.on('click', onMeasureMapClick);
        map.on('mousemove', onMeasureMouseMove);
        map.on('dblclick', onMeasureMapDblClick);

        showToast('Modo Medição Ativado: Clique no mapa para iniciar a medição.', 'info');
    }

    function updateMeasureHudText(text) {
        const el = document.getElementById('measureHudText');
        if (el) el.innerHTML = text;
    }

    function onMeasureMouseMove(e) {
        if (!isMeasureMode) return;
        if (measurePoints.length === 0) return;

        const pLast = measurePoints[measurePoints.length - 1];
        const pCurrent = e.latlng;

        const segNM = haversineNM(pLast.lat, pLast.lng, pCurrent.lat, pCurrent.lng);
        const segBearing = calculateBearing(pLast.lat, pLast.lng, pCurrent.lat, pCurrent.lng);
        const segFormat = formatDistanceMetricAndNautical(segNM);

        let totalNM = 0;
        for (let i = 0; i < measurePoints.length - 1; i++) {
            totalNM += haversineNM(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i+1].lat, measurePoints[i+1].lng);
        }
        totalNM += segNM;
        const totalFormat = formatDistanceMetricAndNautical(totalNM);

        // Update Dynamic Rubber-band Line
        if (!measureDynamicLine) {
            measureDynamicLine = L.polyline([pLast, pCurrent], {
                color: '#f59e0b',
                weight: 3,
                dashArray: '6, 6',
                opacity: 0.95
            }).addTo(measureLayerGroup);
        } else {
            measureDynamicLine.setLatLngs([pLast, pCurrent]);
        }

        // Live Tooltip
        const segIndex = measurePoints.length;
        const tooltipHtml = `
            <div>
                <strong>Reta ${segIndex}:</strong> ${segFormat.nmStr} <span style="color:#93c5fd;">(${segFormat.metricStr})</span>
            </div>
            <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 2px;">
                Rumo: <strong>${segBearing}°</strong> ${measurePoints.length > 1 ? `| Total: <strong>${totalFormat.nmStr}</strong> (${totalFormat.metricStr})` : ''}
            </div>
        `;

        if (!measureTooltip) {
            measureTooltip = L.tooltip({
                permanent: true,
                direction: 'top',
                offset: [0, -12],
                className: 'measure-live-tooltip'
            }).setLatLng(pCurrent).setContent(tooltipHtml).addTo(map);
        } else {
            measureTooltip.setLatLng(pCurrent).setContent(tooltipHtml);
        }

        updateMeasureHudText(`Reta ${segIndex}: <strong>${segFormat.nmStr}</strong> (${segFormat.metricStr}) • Rumo: <strong>${segBearing}°</strong> ${measurePoints.length > 1 ? `| Acumulado: <strong>${totalFormat.nmStr}</strong>` : ''}`);
    }

    function onMeasureMapClick(e) {
        if (!isMeasureMode) return;

        const newPoint = e.latlng;
        measurePoints.push(newPoint);
        const idx = measurePoints.length;

        // Vertex Circle Marker
        const isStart = idx === 1;
        const markerIcon = L.divIcon({
            className: 'measure-vertex-icon-wrapper',
            html: `<div class="measure-vertex-marker ${isStart ? 'start' : ''}"><span>${idx}</span></div>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        L.marker(newPoint, { icon: markerIcon }).addTo(measureLayerGroup);

        if (idx === 1) {
            updateMeasureHudText('Ponto 1 fixado. Mova o mouse para esticar a 1ª reta e clique para fixar o ponto 2.');
        } else {
            // Fix previous segment
            const pPrev = measurePoints[idx - 2];
            const segNM = haversineNM(pPrev.lat, pPrev.lng, newPoint.lat, newPoint.lng);
            const segFormat = formatDistanceMetricAndNautical(segNM);
            const segBearing = calculateBearing(pPrev.lat, pPrev.lng, newPoint.lat, newPoint.lng);

            // Fixed Solid Line
            L.polyline([pPrev, newPoint], {
                color: '#38bdf8',
                weight: 4,
                opacity: 0.95
            }).addTo(measureLayerGroup);

            // Midpoint Segment Badge
            const midLat = (pPrev.lat + newPoint.lat) / 2;
            const midLng = (pPrev.lng + newPoint.lng) / 2;
            const badgeIcon = L.divIcon({
                className: 'measure-badge-wrapper',
                html: `<div class="measure-segment-badge"><span>${segFormat.nmStr}</span> <small>(${segFormat.metricStr})</small></div>`,
                iconSize: [160, 24],
                iconAnchor: [80, 12]
            });
            L.marker([midLat, midLng], { icon: badgeIcon, interactive: false }).addTo(measureLayerGroup);

            // Reset dynamic line anchor to newPoint
            if (measureDynamicLine) {
                measureDynamicLine.setLatLngs([newPoint, newPoint]);
            }

            let totalNM = 0;
            for (let i = 0; i < measurePoints.length - 1; i++) {
                totalNM += haversineNM(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i+1].lat, measurePoints[i+1].lng);
            }
            const totalFormat = formatDistanceMetricAndNautical(totalNM);

            updateMeasureHudText(`Reta ${idx - 1} fixada: <strong>${segFormat.nmStr}</strong> (${segFormat.metricStr}) • Total: <strong>${totalFormat.nmStr}</strong>. Mova o mouse para a próxima reta ou dê duplo-clique para finalizar.`);
        }
    }

    function onMeasureMapDblClick(e) {
        if (!isMeasureMode) return;
        L.DomEvent.stop(e);

        if (measureDynamicLine) {
            measureLayerGroup.removeLayer(measureDynamicLine);
            measureDynamicLine = null;
        }
        if (measureTooltip) {
            map.removeLayer(measureTooltip);
            measureTooltip = null;
        }

        let totalNM = 0;
        for (let i = 0; i < measurePoints.length - 1; i++) {
            totalNM += haversineNM(measurePoints[i].lat, measurePoints[i].lng, measurePoints[i+1].lat, measurePoints[i+1].lng);
        }
        const totalFormat = formatDistanceMetricAndNautical(totalNM);

        updateMeasureHudText(`Medição concluída! Distância total: <strong>${totalFormat.nmStr}</strong> (${totalFormat.metricStr}) em ${Math.max(1, measurePoints.length - 1)} reta(s).`);
        showToast(`Medição finalizada: ${totalFormat.nmStr} (${totalFormat.metricStr})`, 'success');
    }

    function clearMeasureData() {
        measurePoints = [];
        measureLayerGroup.clearLayers();
        if (measureDynamicLine) {
            measureDynamicLine = null;
        }
        if (measureTooltip) {
            map.removeLayer(measureTooltip);
            measureTooltip = null;
        }
        updateMeasureHudText('Medição limpa. Clique no mapa para iniciar uma nova medição.');
    }

    function stopMeasureMode() {
        clearMeasureData();
        isMeasureMode = false;
        document.getElementById('btnToggleMeasure')?.classList.remove('active');
        map.getContainer().style.cursor = '';
        map.doubleClickZoom.enable();

        map.off('click', onMeasureMapClick);
        map.off('mousemove', onMeasureMouseMove);
        map.off('dblclick', onMeasureMapDblClick);

        const hud = document.getElementById('measureHud');
        if (hud) hud.remove();
    }

    document.getElementById('btnToggleMeasure')?.addEventListener('click', toggleMeasureMode);

    // =========================================================================
    // MODO INSPEÇÃO E FIXAÇÃO DE COORDENADAS POR ALFINETE (PIN INSPECT)
    // =========================================================================
    function togglePinInspectMode() {
        if (isPinInspectMode) {
            stopPinInspectMode();
        } else {
            startPinInspectMode();
        }
    }

    function startPinInspectMode() {
        if (isMeasureMode) {
            stopMeasureMode();
        }
        if (typeof isDrawDerrotaMode !== 'undefined' && isDrawDerrotaMode) {
            stopDrawDerrotaMode();
        }

        isPinInspectMode = true;
        document.getElementById('btnTogglePinInspect')?.classList.add('active');
        map.getContainer().style.cursor = 'crosshair';

        let hud = document.getElementById('pinInspectHud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'pinInspectHud';
            hud.className = 'pin-inspect-hud';
            hud.innerHTML = `
                <div class="pin-inspect-hud-info">
                    <i class="fa-solid fa-map-pin text-gold"></i>
                    <span id="pinInspectHudText">Mova o mouse para ler coordenadas • Clique no mapa para fixar o alfinete.</span>
                </div>
                <div class="pin-inspect-hud-actions">
                    <button type="button" class="btn-pin-hud" id="btnPinInspectClear" style="display:none;" title="Remover alfinete e continuar inspecionando"><i class="fa-solid fa-location-crosshairs"></i> Desafixar</button>
                    <button type="button" class="btn-pin-hud btn-pin-close" id="btnPinInspectClose" title="Sair do modo alfinete (ESC)"><i class="fa-solid fa-xmark"></i> Sair</button>
                </div>
            `;
            document.querySelector('.app-map-wrapper')?.appendChild(hud);
            document.getElementById('btnPinInspectClear')?.addEventListener('click', clearPinInspectMarker);
            document.getElementById('btnPinInspectClose')?.addEventListener('click', stopPinInspectMode);
        } else {
            hud.style.display = 'flex';
            updatePinInspectHudText('Mova o mouse para ler coordenadas • Clique no mapa para fixar o alfinete.');
            const clearBtn = document.getElementById('btnPinInspectClear');
            if (clearBtn && !pinInspectMarker) clearBtn.style.display = 'none';
        }

        map.on('mousemove', onPinInspectMouseMove);
        map.on('click', onPinInspectMapClick);

        showToast('Modo Alfinete Ativado: Mova o mouse para ler ou clique no mapa para fixar coordenadas. (ESC para sair)', 'info');
    }

    function updatePinInspectHudText(text) {
        const el = document.getElementById('pinInspectHudText');
        if (el) el.innerHTML = text;
    }

    function formatCoordTexts(lat, lng) {
        let latDDM = '';
        let lngDDM = '';
        if (typeof decimalToDDM === 'function') {
            latDDM = decimalToDDM(lat, true).formatted;
            lngDDM = decimalToDDM(lng, false).formatted;
        } else {
            latDDM = `${lat.toFixed(5)}°`;
            lngDDM = `${lng.toFixed(5)}°`;
        }
        const decLat = lat.toFixed(6);
        const decLng = lng.toFixed(6);
        return { latDDM, lngDDM, decLat, decLng, fullCopy: `${latDDM}, ${lngDDM} (${decLat}, ${decLng})` };
    }

    function onPinInspectMouseMove(e) {
        if (!isPinInspectMode) return;
        const coords = formatCoordTexts(e.latlng.lat, e.latlng.lng);

        if (!pinInspectMarker) {
            updatePinInspectHudText(`Lat: <strong>${coords.latDDM}</strong> | Long: <strong>${coords.lngDDM}</strong> <small style="color:#94a3b8;">(${coords.decLat}, ${coords.decLng})</small> • Clique para fixar`);
        }

        const tooltipHtml = `
            <div style="font-size:0.72rem; color:#f59e0b; font-weight:700; text-transform:uppercase; margin-bottom:2px;">
                <i class="fa-solid fa-map-pin"></i> Inspecionar Ponto
            </div>
            <div style="font-weight:700; color:#ffffff; font-size:0.85rem; line-height:1.3;">
                ${coords.latDDM}<br>${coords.lngDDM}
            </div>
            <div style="font-size:0.72rem; color:#94a3b8; margin-top:2px;">
                ${coords.decLat}°, ${coords.decLng}°
            </div>
            <div style="font-size:0.68rem; color:#38bdf8; margin-top:3px; font-weight:600;">
                Clique no mapa para fixar o alfinete
            </div>
        `;

        if (!pinInspectTooltip) {
            pinInspectTooltip = L.tooltip({
                permanent: true,
                direction: 'top',
                offset: [0, -15],
                className: 'pin-live-tooltip'
            }).setLatLng(e.latlng).setContent(tooltipHtml).addTo(map);
        } else {
            pinInspectTooltip.setLatLng(e.latlng).setContent(tooltipHtml);
        }
    }

    function onPinInspectMapClick(e) {
        if (!isPinInspectMode) return;
        const latlng = e.latlng || e;
        const coords = formatCoordTexts(latlng.lat, latlng.lng);

        if (pinInspectTooltip) {
            map.removeLayer(pinInspectTooltip);
            pinInspectTooltip = null;
        }

        const pinIcon = L.divIcon({
            className: 'pin-fixed-icon-wrapper',
            html: `
                <div class="pin-fixed-marker">
                    <i class="fa-solid fa-map-pin"></i>
                    <span class="pin-pulse"></span>
                </div>
            `,
            iconSize: [32, 38],
            iconAnchor: [16, 36],
            popupAnchor: [0, -36]
        });

        if (!pinInspectMarker) {
            pinInspectMarker = L.marker(latlng, { icon: pinIcon, draggable: true }).addTo(pinInspectLayerGroup);
            pinInspectMarker.on('dragend', (ev) => {
                onPinInspectMapClick(ev.target.getLatLng());
            });
        } else {
            pinInspectMarker.setLatLng(latlng);
        }

        const popupContent = `
            <div class="pin-popup-card">
                <div class="pin-popup-header">
                    <div class="pin-popup-title">
                        <i class="fa-solid fa-map-pin"></i> Alfinete Fixado
                    </div>
                </div>
                <div class="pin-popup-coords">
                    <div class="pin-popup-row">
                        <span class="pin-popup-label">Latitude DDM:</span>
                        <span class="pin-popup-val">${coords.latDDM}</span>
                    </div>
                    <div class="pin-popup-row">
                        <span class="pin-popup-label">Longitude DDM:</span>
                        <span class="pin-popup-val">${coords.lngDDM}</span>
                    </div>
                    <div class="pin-popup-row" style="margin-top:4px; padding-top:4px; border-top:1px dashed rgba(255,255,255,0.1);">
                        <span class="pin-popup-label">Decimal:</span>
                        <span class="pin-popup-val" style="color:#93c5fd;">${coords.decLat}, ${coords.decLng}</span>
                    </div>
                </div>
                <div class="pin-popup-actions">
                    <button type="button" class="btn-pin-copy" id="btnCopyPinCoords">
                        <i class="fa-solid fa-copy"></i> Copiar
                    </button>
                    <button type="button" class="btn-pin-dismiss" id="btnDismissPin">
                        <i class="fa-solid fa-xmark"></i> Fechar
                    </button>
                </div>
            </div>
        `;

        pinInspectMarker.bindPopup(popupContent, {
            className: 'pin-inspect-popup',
            offset: [0, -18],
            closeOnClick: false
        }).openPopup();

        setTimeout(() => {
            document.getElementById('btnCopyPinCoords')?.addEventListener('click', () => {
                navigator.clipboard.writeText(coords.fullCopy).then(() => {
                    showToast('Coordenadas copiadas para a área de transferência!', 'success');
                    const copyBtn = document.getElementById('btnCopyPinCoords');
                    if (copyBtn) copyBtn.innerHTML = '<i class="fa-solid fa-check" style="color:#22c55e;"></i> Copiado!';
                }).catch(() => {
                    showToast(`${coords.fullCopy}`, 'info');
                });
            });
            document.getElementById('btnDismissPin')?.addEventListener('click', () => {
                stopPinInspectMode();
            });
        }, 50);

        updatePinInspectHudText(`Alfinete fixado: <strong>${coords.latDDM}</strong>, <strong>${coords.lngDDM}</strong> <small style="color:#93c5fd;">(${coords.decLat}, ${coords.decLng})</small> • Pressione ESC ou Fechar para sair`);

        const clearBtn = document.getElementById('btnPinInspectClear');
        if (clearBtn) clearBtn.style.display = 'inline-flex';
    }

    function clearPinInspectMarker() {
        if (pinInspectMarker) {
            pinInspectLayerGroup.removeLayer(pinInspectMarker);
            pinInspectMarker = null;
        }
        const clearBtn = document.getElementById('btnPinInspectClear');
        if (clearBtn) clearBtn.style.display = 'none';
        updatePinInspectHudText('Mova o mouse para ler coordenadas • Clique no mapa para fixar o alfinete.');
    }

    function stopPinInspectMode() {
        clearPinInspectMarker();
        if (pinInspectTooltip) {
            map.removeLayer(pinInspectTooltip);
            pinInspectTooltip = null;
        }
        isPinInspectMode = false;
        document.getElementById('btnTogglePinInspect')?.classList.remove('active');
        map.getContainer().style.cursor = '';

        map.off('mousemove', onPinInspectMouseMove);
        map.off('click', onPinInspectMapClick);

        const hud = document.getElementById('pinInspectHud');
        if (hud) hud.remove();
    }

    document.getElementById('btnTogglePinInspect')?.addEventListener('click', togglePinInspectMode);

    document.getElementById('btnMapReset')?.addEventListener('click', () => {
        map.flyTo([-0.5, -49.0], 8, { duration: 1.2 });
    });

    document.querySelectorAll('[data-close]').forEach(btn => {
        btn.addEventListener('click', () => {
            const modalId = btn.getAttribute('data-close');
            document.getElementById(modalId)?.classList.remove('active');
        });
    });

    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
        backdrop.addEventListener('click', (e) => {
            if (e.target === backdrop) backdrop.classList.remove('active');
        });
    });

    // Close active modal, measurement mode, route drawing mode, pin inspection mode or photo lightbox on ESC key press
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
            if (isPinInspectMode) {
                stopPinInspectMode();
                return;
            }
            if (isMeasureMode) {
                stopMeasureMode();
                return;
            }
            if (isDrawDerrotaMode) {
                stopDrawDerrotaMode();
                return;
            }
            const activeLightbox = document.getElementById('modalPhotoLightbox');
            if (activeLightbox && activeLightbox.classList.contains('active')) {
                activeLightbox.classList.remove('active');
                return;
            }
            const activeModals = document.querySelectorAll('.modal-backdrop.active');
            if (activeModals.length > 0) {
                activeModals[activeModals.length - 1].classList.remove('active');
            }
        }
    });

    document.getElementById('btnOpenSimulator')?.addEventListener('click', openSimulator);
    document.getElementById('btnOpenSimulator2')?.addEventListener('click', openSimulator);

    // =========================================================================
    // 13. CRIAR E EXCLUIR SINAIS (COM SUPORTE A RESPONSÁVEL E PERSISTÊNCIA)
    // =========================================================================
    const modalAddSignal = document.getElementById('modalAddSignal');
    const btnTabCreateMode = document.getElementById('btnTabCreateMode');
    const btnTabDeleteMode = document.getElementById('btnTabDeleteMode');
    const panelCreateSignal = document.getElementById('panelCreateSignal');
    const panelDeleteSignal = document.getElementById('panelDeleteSignal');

    function switchManageMode(mode) {
        if (mode === 'create') {
            if (panelCreateSignal) panelCreateSignal.style.display = 'block';
            if (panelDeleteSignal) panelDeleteSignal.style.display = 'none';
        } else {
            if (panelDeleteSignal) panelDeleteSignal.style.display = 'block';
            if (panelCreateSignal) panelCreateSignal.style.display = 'none';
            populateDeleteSignalSelectModal();
        }
    }

    if (btnTabCreateMode && btnTabDeleteMode) {
        btnTabCreateMode.addEventListener('click', () => switchManageMode('create'));
        btnTabDeleteMode.addEventListener('click', () => switchManageMode('delete'));
    }

    document.getElementById('btnOpenAddSignalHeader')?.addEventListener('click', () => {
        document.getElementById('formAddSignal')?.reset();
        switchManageMode('create');
        modalAddSignal?.classList.add('active');
    });

    function populateDeleteSignalSelectModal() {
        const select = document.getElementById('selectSignalToDeleteModal');
        if (!select) return;

        if (signalsData.length === 0) {
            select.innerHTML = '<option value="">Nenhum sinal cadastrado</option>';
            return;
        }

        select.innerHTML = signalsData.map(s => `
            <option value="${s.code}">${s.code} - ${s.name} (${s.type}) [${s.responsavel || 'CHN-4'}]</option>
        `).join('');

        select.value = signalsData[0].code;
        updateDeletePreviewCardModal(signalsData[0].code);
    }

    function updateDeletePreviewCardModal(code) {
        const signal = signalsData.find(s => s.code === code);
        if (!signal) return;

        const isOp = isOperational(signal.status);
        document.getElementById('delPreviewCode').textContent = signal.code;
        document.getElementById('delPreviewStatus').textContent = signal.status;
        document.getElementById('delPreviewStatus').className = `badge ${isOp ? 'badge-op' : 'badge-av'}`;
        document.getElementById('delPreviewName').textContent = signal.name;
        document.getElementById('delPreviewType').textContent = signal.type;
        document.getElementById('delPreviewPos').textContent = `Lat: ${toDMS(signal.lat, true)}, Lng: ${toDMS(signal.lng, false)}`;
        document.getElementById('delPreviewJurisdiction').textContent = `Jurisdição: ${signal.jurisdiction || 'CHN-4'}`;
        document.getElementById('delPreviewResponsavel').textContent = `Responsável: ${signal.responsavel || 'CHN-4'}`;
    }

    document.getElementById('selectSignalToDeleteModal')?.addEventListener('change', (e) => {
        updateDeletePreviewCardModal(e.target.value);
    });

    document.getElementById('btnConfirmDeleteSignalModal')?.addEventListener('click', () => {
        const select = document.getElementById('selectSignalToDeleteModal');
        if (!select || !select.value) return;

        deleteSignalPermanently(select.value, select.options[select.selectedIndex].text);
    });

    // Form Submit: Save New Signal
    document.getElementById('formAddSignal')?.addEventListener('submit', async (e) => {
        e.preventDefault();

        let lat = parseFloat(document.getElementById('addLat')?.value);
        let lng = parseFloat(document.getElementById('addLng')?.value);

        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
            const latDeg = document.getElementById('addLatDeg')?.value;
            const latMin = document.getElementById('addLatMin')?.value;
            const latHem = document.getElementById('addLatHem')?.value;
            const lngDeg = document.getElementById('addLngDeg')?.value;
            const lngMin = document.getElementById('addLngMin')?.value;
            const lngHem = document.getElementById('addLngHem')?.value;

            if (latDeg !== '' && latMin !== '' && lngDeg !== '' && lngMin !== '') {
                lat = ddmToDecimal(latDeg, latMin, latHem);
                lng = ddmToDecimal(lngDeg, lngMin, lngHem);
            }
        }

        if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
            showToast('Informe as coordenadas de posição válidas.', 'danger');
            return;
        }

        const code = document.getElementById('addCode').value.trim();
        if (signalsData.some(s => s.code === code)) {
            showToast(`Já existe um sinal com o código ${code}.`, 'danger');
            return;
        }

        const now = new Date();
        const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const statusVal = document.getElementById('addStatus').value;
        const responsavelVal = document.getElementById('addResponsavel').value;

        const newSignal = {
            code: code,
            name: document.getElementById('addName').value.trim(),
            type: document.getElementById('addType').value,
            status: statusVal,
            lat: lat,
            lng: lng,
            characteristic: document.getElementById('addCharacteristic').value.trim() || 'Lp. W. 5s 6m 8NM',
            rangeNM: parseFloat(document.getElementById('addRange').value) || 6,
            altitudeM: parseFloat(document.getElementById('addAltitude').value) || 5,
            jurisdiction: document.getElementById('addJurisdiction').value.trim() || `Jurisdição ${responsavelVal}`,
            responsavel: responsavelVal,
            contingencyPlan: document.getElementById('addContingencyPlan')?.value?.trim() || '',
            image: null,
            photoDate: null,
            history: [
                { date: dateStr, status: statusVal, note: `Sinal cadastrado no sistema. Responsável: ${responsavelVal}` }
            ]
        };

        // Modo Visualizador: Criação desativada na nuvem

        signalsData.push(newSignal);
        signalsData.sort(compareSignalCodes);
        saveLocalCache();
        updateIE();
        renderMapMarkers();
        renderSignalList();

        modalAddSignal?.classList.remove('active');
        showToast(`Sinal ${code} registrado e salvo no banco de dados!`, 'success');

        map.flyTo([lat, lng], 12, { duration: 1.2 });
        if (mapMarkers[code]) mapMarkers[code].openPopup();
    });

    // =========================================================================
    // 14. INTEROPERABILIDADE E SINCRONIZAÇÃO EM TEMPO REAL (FIREBASE FIRESTORE / SSE)
    // =========================================================================
    function setupRealtimeSync() {
        const syncText = document.getElementById('syncStatusText');
        const syncDot = document.querySelector('#syncStatusBadge .sync-dot');

        // Priority 1: Firebase Cloud Firestore Real-time listener (Nuvem / GitHub Pages)
        if (typeof isFirebaseActive !== 'undefined' && isFirebaseActive && db) {
            if (syncText) syncText.textContent = 'ONLINE (FIREBASE CLOUD)';
            if (syncDot) syncDot.className = 'sync-dot sync-online';

            db.collection("signals").onSnapshot((snapshot) => {
                if (!snapshot.empty) {
                    const remoteSignals = [];
                    snapshot.forEach(doc => {
                        remoteSignals.push(doc.data());
                    });
                    signalsData = remoteSignals;
                    signalsData.sort(compareSignalCodes);
                    saveLocalCache();
                    updateTypeFilterDropdown();
                    updateIE();
                    renderMapMarkers();
                    renderSignalList();

                    if (selectedSignal) {
                        const updated = signalsData.find(s => s.code === selectedSignal.code);
                        if (updated) {
                            selectedSignal = updated;
                            renderSignalPhoto(selectedSignal);
                        }
                    }
                    console.log(`🔥 Cloud Firestore: ${signalsData.length} sinais sincronizados em tempo real.`);
                } else {
                    console.log("🔥 Firestore snapshot recebido vazio no visualizador.");
                }
            }, (err) => {
                console.warn("⚠️ Aviso no listener Firestore (Viewer):", err);
                if (syncText) syncText.textContent = 'OFFLINE / ERRO FIREBASE';
                if (syncDot) syncDot.className = 'sync-dot sync-offline';
                showToast('⚠️ Falha ao conectar ao Firebase Cloud. Operando com dados locais seguros.', 'warning');
            });
            return;
        }

        // Priority 2: Local Server-Sent Events (SSE) fallback
        if (typeof EventSource === 'undefined') return;

        try {
            const evtSource = new EventSource('/api/events');

            evtSource.onopen = () => {
                if (syncText) syncText.textContent = 'ONLINE (MULTI-USUÁRIO LOCAL)';
                if (syncDot) syncDot.className = 'sync-dot sync-online';
            };

            evtSource.addEventListener('signal-change', async (event) => {
                try {
                    console.log('Realtime SSE Event received:', event.data);
                    const resp = await fetch('/api/signals');
                    if (resp.ok) {
                        signalsData = await resp.json();
                        signalsData.sort(compareSignalCodes);
                        saveLocalCache();
                        updateTypeFilterDropdown();
                        updateIE();
                        renderMapMarkers();
                        renderSignalList();
                        
                        if (selectedSignal) {
                            const updated = signalsData.find(s => s.code === selectedSignal.code);
                            if (updated) {
                                selectedSignal = updated;
                                renderSignalPhoto(selectedSignal);
                            }
                        }

                        showToast('📢 Atualização remota recebida! Base sincronizada.', 'info');
                    }
                } catch (err) {
                    console.warn('SSE event parsing error:', err);
                }
            });

            evtSource.onerror = () => {
                if (syncText) syncText.textContent = 'MODO LOCAL';
                if (syncDot) syncDot.className = 'sync-dot sync-offline';
            };
        } catch (err) {
            console.warn('Realtime sync setup skipped.', err);
        }
    }

    // =========================================================================
    // NÁUTICO (GG° MM.mm' S/N e GGG° MM.mm' E/W) <-> DECIMAL (DD) COORDINATE CONVERTERS
    // =========================================================================
    function ddmToDecimal(deg, min, hem) {
        const d = Math.abs(parseFloat(deg) || 0);
        const m = Math.abs(parseFloat(min) || 0);
        let dec = d + (m / 60);
        if (hem === 'S' || hem === 'W') dec = -dec;
        return dec;
    }

    function decimalToDDM(dec, isLat) {
        const num = parseFloat(dec);
        if (isNaN(num)) return { deg: '', min: '', hem: isLat ? 'S' : 'W' };
        const isNegative = num < 0;
        const hem = isNegative ? (isLat ? 'S' : 'W') : (isLat ? 'N' : 'E');
        const abs = Math.abs(num);
        const deg = Math.floor(abs);
        const min = (abs - deg) * 60;
        const degPad = isLat ? 2 : 3;
        const degStr = String(deg).padStart(degPad, '0');
        const minStr = min.toFixed(2).padStart(5, '0');
        return {
            deg: degStr,
            min: minStr,
            hem: hem,
            formatted: `${degStr}° ${minStr}' ${hem}`
        };
    }

    // Aliases for compatibility
    const gmsToDecimal = ddmToDecimal;
    const decimalToGMS = decimalToDDM;

    document.getElementById('btnCoordModeGMS')?.addEventListener('click', () => {
        document.getElementById('btnCoordModeGMS')?.classList.add('active');
        document.getElementById('btnCoordModeDecimal')?.classList.remove('active');
        document.getElementById('panelCoordGMS').style.display = 'block';
        document.getElementById('panelCoordDecimal').style.display = 'none';
        const addLatDeg = document.getElementById('addLatDeg');
        const addLngDeg = document.getElementById('addLngDeg');
        if (addLatDeg) addLatDeg.required = true;
        if (addLngDeg) addLngDeg.required = true;
        const addLat = document.getElementById('addLat');
        const addLng = document.getElementById('addLng');
        if (addLat) addLat.required = false;
        if (addLng) addLng.required = false;
    });

    document.getElementById('btnCoordModeDecimal')?.addEventListener('click', () => {
        document.getElementById('btnCoordModeDecimal')?.classList.add('active');
        document.getElementById('btnCoordModeGMS')?.classList.remove('active');
        document.getElementById('panelCoordDecimal').style.display = 'block';
        document.getElementById('panelCoordGMS').style.display = 'none';
        const addLat = document.getElementById('addLat');
        const addLng = document.getElementById('addLng');
        if (addLat) addLat.required = true;
        if (addLng) addLng.required = true;
        const addLatDeg = document.getElementById('addLatDeg');
        const addLngDeg = document.getElementById('addLngDeg');
        if (addLatDeg) addLatDeg.required = false;
        if (addLngDeg) addLngDeg.required = false;
    });

    function syncGmsToDecimal() {
        const latDeg = document.getElementById('addLatDeg')?.value;
        const latMin = document.getElementById('addLatMin')?.value;
        const latHem = document.getElementById('addLatHem')?.value;

        if (latDeg !== '' && latMin !== '') {
            const latDec = ddmToDecimal(latDeg, latMin, latHem);
            const addLatEl = document.getElementById('addLat');
            if (addLatEl) addLatEl.value = latDec.toFixed(7);
        }

        const lngDeg = document.getElementById('addLngDeg')?.value;
        const lngMin = document.getElementById('addLngMin')?.value;
        const lngHem = document.getElementById('addLngHem')?.value;

        if (lngDeg !== '' && lngMin !== '') {
            const lngDec = ddmToDecimal(lngDeg, lngMin, lngHem);
            const addLngEl = document.getElementById('addLng');
            if (addLngEl) addLngEl.value = lngDec.toFixed(7);
        }
    }

    function syncDecimalToGms() {
        const latVal = document.getElementById('addLat')?.value;
        if (latVal !== '') {
            const ddm = decimalToDDM(latVal, true);
            if (document.getElementById('addLatDeg')) document.getElementById('addLatDeg').value = ddm.deg;
            if (document.getElementById('addLatMin')) document.getElementById('addLatMin').value = ddm.min;
            if (document.getElementById('addLatHem')) document.getElementById('addLatHem').value = ddm.hem;
        }

        const lngVal = document.getElementById('addLng')?.value;
        if (lngVal !== '') {
            const ddm = decimalToDDM(lngVal, false);
            if (document.getElementById('addLngDeg')) document.getElementById('addLngDeg').value = ddm.deg;
            if (document.getElementById('addLngMin')) document.getElementById('addLngMin').value = ddm.min;
            if (document.getElementById('addLngHem')) document.getElementById('addLngHem').value = ddm.hem;
        }
    }

    ['addLatDeg', 'addLatMin', 'addLatHem', 'addLngDeg', 'addLngMin', 'addLngHem'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', syncGmsToDecimal);
        document.getElementById(id)?.addEventListener('change', syncGmsToDecimal);
    });

    ['addLat', 'addLng'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', syncDecimalToGms);
        document.getElementById(id)?.addEventListener('change', syncDecimalToGms);
    });

    // Map Click Point Capture Listener
    document.getElementById('btnPickPointOnMap')?.addEventListener('click', () => {
        const modalAdd = document.getElementById('modalAddSignal');
        if (modalAdd) modalAdd.classList.remove('active');
        showToast('Clique no mapa na posição exata do novo sinal náutico...', 'info');
        map.getContainer().style.cursor = 'crosshair';

        map.once('click', (e) => {
            map.getContainer().style.cursor = '';
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            const addLatEl = document.getElementById('addLat');
            const addLngEl = document.getElementById('addLng');
            if (addLatEl) addLatEl.value = lat.toFixed(7);
            if (addLngEl) addLngEl.value = lng.toFixed(7);

            syncDecimalToGms();

            if (modalAdd) modalAdd.classList.add('active');
            showToast(`Posição capturada: ${formatNauticalCoord(lat, true)} | ${formatNauticalCoord(lng, false)}`, 'success');
        });
    });

    // =========================================================================
    // EDIT FICHA TÉCNICA COORDINATE MODE & SYNC HANDLERS
    // =========================================================================
    document.getElementById('btnEditCoordModeGMS')?.addEventListener('click', () => {
        document.getElementById('btnEditCoordModeGMS')?.classList.add('active');
        document.getElementById('btnEditCoordModeDecimal')?.classList.remove('active');
        const panelGms = document.getElementById('panelEditCoordGMS');
        const panelDec = document.getElementById('panelEditCoordDecimal');
        if (panelGms) panelGms.style.display = 'block';
        if (panelDec) panelDec.style.display = 'none';
        const editLatDeg = document.getElementById('editLatDeg');
        const editLngDeg = document.getElementById('editLngDeg');
        if (editLatDeg) editLatDeg.required = true;
        if (editLngDeg) editLngDeg.required = true;
        const editLat = document.getElementById('editLat');
        const editLng = document.getElementById('editLng');
        if (editLat) editLat.required = false;
        if (editLng) editLng.required = false;
    });

    document.getElementById('btnEditCoordModeDecimal')?.addEventListener('click', () => {
        document.getElementById('btnEditCoordModeDecimal')?.classList.add('active');
        document.getElementById('btnEditCoordModeGMS')?.classList.remove('active');
        const panelGms = document.getElementById('panelEditCoordGMS');
        const panelDec = document.getElementById('panelEditCoordDecimal');
        if (panelDec) panelDec.style.display = 'block';
        if (panelGms) panelGms.style.display = 'none';
        const editLat = document.getElementById('editLat');
        const editLng = document.getElementById('editLng');
        if (editLat) editLat.required = true;
        if (editLng) editLng.required = true;
        const editLatDeg = document.getElementById('editLatDeg');
        const editLngDeg = document.getElementById('editLngDeg');
        if (editLatDeg) editLatDeg.required = false;
        if (editLngDeg) editLngDeg.required = false;
    });

    function syncEditGmsToDecimal() {
        const latDeg = document.getElementById('editLatDeg')?.value;
        const latMin = document.getElementById('editLatMin')?.value;
        const latHem = document.getElementById('editLatHem')?.value;

        if (latDeg !== '' && latMin !== '') {
            const latDec = ddmToDecimal(latDeg, latMin, latHem);
            const editLatEl = document.getElementById('editLat');
            if (editLatEl) editLatEl.value = latDec.toFixed(7);
        }

        const lngDeg = document.getElementById('editLngDeg')?.value;
        const lngMin = document.getElementById('editLngMin')?.value;
        const lngHem = document.getElementById('editLngHem')?.value;

        if (lngDeg !== '' && lngMin !== '') {
            const lngDec = ddmToDecimal(lngDeg, lngMin, lngHem);
            const editLngEl = document.getElementById('editLng');
            if (editLngEl) editLngEl.value = lngDec.toFixed(7);
        }
    }

    function syncEditDecimalToGms() {
        const latVal = document.getElementById('editLat')?.value;
        if (latVal !== '') {
            const ddm = decimalToDDM(latVal, true);
            if (document.getElementById('editLatDeg')) document.getElementById('editLatDeg').value = ddm.deg;
            if (document.getElementById('editLatMin')) document.getElementById('editLatMin').value = ddm.min;
            if (document.getElementById('editLatHem')) document.getElementById('editLatHem').value = ddm.hem;
        }

        const lngVal = document.getElementById('editLng')?.value;
        if (lngVal !== '') {
            const ddm = decimalToDDM(lngVal, false);
            if (document.getElementById('editLngDeg')) document.getElementById('editLngDeg').value = ddm.deg;
            if (document.getElementById('editLngMin')) document.getElementById('editLngMin').value = ddm.min;
            if (document.getElementById('editLngHem')) document.getElementById('editLngHem').value = ddm.hem;
        }
    }

    ['editLatDeg', 'editLatMin', 'editLatHem', 'editLngDeg', 'editLngMin', 'editLngHem'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', syncEditGmsToDecimal);
        document.getElementById(id)?.addEventListener('change', syncEditGmsToDecimal);
    });

    ['editLat', 'editLng'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', syncEditDecimalToGms);
        document.getElementById(id)?.addEventListener('change', syncEditDecimalToGms);
    });

    // Map Click Point Capture Listener for Edit Form
    document.getElementById('btnPickPointOnMapEdit')?.addEventListener('click', () => {
        const modalDetail = document.getElementById('modalSignalDetail');
        if (modalDetail) modalDetail.classList.remove('active');
        showToast('Clique no mapa na nova posição do sinal náutico...', 'info');
        map.getContainer().style.cursor = 'crosshair';

        map.once('click', (e) => {
            map.getContainer().style.cursor = '';
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;

            const editLatEl = document.getElementById('editLat');
            const editLngEl = document.getElementById('editLng');
            if (editLatEl) editLatEl.value = lat.toFixed(7);
            if (editLngEl) editLngEl.value = lng.toFixed(7);

            syncEditDecimalToGms();

            if (modalDetail) modalDetail.classList.add('active');
            showToast(`Nova posição capturada: ${formatNauticalCoord(lat, true)} | ${formatNauticalCoord(lng, false)}`, 'success');
        });
    });

    // =========================================================================
    // 16. GESTÃO DE PONTOS DE PARADA & BACKUPS
    // =========================================================================
    const modalBackups = document.getElementById('modalBackups');
    const btnOpenBackupsModal = document.getElementById('btnOpenBackupsModal');
    const btnCreateManualBackup = document.getElementById('btnCreateManualBackup');
    const btnImportBackupFileTrigger = document.getElementById('btnImportBackupFileTrigger');
    const inputBackupFile = document.getElementById('inputBackupFile');

    btnOpenBackupsModal?.addEventListener('click', () => {
        loadBackupsList();
        modalBackups?.classList.add('active');
    });

    async function loadBackupsList() {
        const tableBody = document.getElementById('backupsListTableBody');
        if (!tableBody) return;

        tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-3 text-muted">Buscando pontos de parada...</td></tr>';

        let serverBackups = [];
        try {
            const resp = await fetch('/api/backups');
            if (resp.ok) {
                serverBackups = await resp.json();
            }
        } catch (e) {
            console.warn('API REST /api/backups indisponível.', e);
        }

        let localBackups = [];
        try {
            const localRaw = localStorage.getItem('chn4_aton_backups_history');
            if (localRaw) localBackups = JSON.parse(localRaw);
        } catch (e) {}

        const allBackups = [];
        if (Array.isArray(serverBackups)) {
            serverBackups.forEach(b => allBackups.push({ ...b, isLocal: false }));
        }
        if (Array.isArray(localBackups)) {
            localBackups.forEach((b, idx) => {
                allBackups.push({ ...b, localIndex: idx, isLocal: true, filename: b.filename || null });
            });
        }

        if (allBackups.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-3 text-muted">Nenhum ponto de parada ou backup encontrado. Clique em "Criar Ponto de Parada Agora".</td></tr>';
            return;
        }

        tableBody.innerHTML = '';
        allBackups.forEach(b => {
            const tr = document.createElement('tr');
            tr.style.borderBottom = '1px solid var(--border-color)';

            const badgeOrigin = b.isLocal 
                ? '<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,193,7,0.15); color: var(--accent-gold); border: 1px solid var(--accent-gold); margin-left: 6px;">Navegador</span>' 
                : '<span style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(76,175,80,0.15); color: var(--status-op); border: 1px solid var(--status-op); margin-left: 6px;">Disco</span>';

            const restoreParam = b.filename ? `'${b.filename}', false, null` : `null, true, ${b.localIndex}`;

            tr.innerHTML = `
                <td style="padding: 10px 8px; font-weight: 500;">
                    <i class="fa-solid fa-calendar-check text-gold"></i> ${b.formattedDate || b.createdAt} ${badgeOrigin}
                </td>
                <td style="padding: 10px 8px;">
                    <span class="backup-badge-count">${b.count || (b.signals ? b.signals.length : 0)} sinais</span>
                </td>
                <td style="padding: 10px 8px; color: var(--text-secondary);">
                    ${b.note || 'Ponto de Parada'}
                </td>
                <td style="padding: 10px 8px; text-align: right;">
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button class="btn btn-primary btn-sm" onclick="window.restoreBackupPoint(${restoreParam})" title="Restaurar base de dados para este ponto">
                            <i class="fa-solid fa-rotate-left"></i> Restaurar
                        </button>
                        ${b.filename ? `<button class="btn btn-outline btn-sm" onclick="window.downloadBackupFile('${b.filename}')" title="Baixar arquivo JSON de backup"><i class="fa-solid fa-download"></i></button>` : ''}
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });
    }

    btnCreateManualBackup?.addEventListener('click', async () => {
        const notePrompt = prompt("Digite uma descrição / nota para este Ponto de Parada (opcional):", "Backup manual do operador");
        if (notePrompt === null) return;

        const note = notePrompt.trim() || 'Ponto de parada manual';

        try {
            const resp = await fetch('/api/backups/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: note })
            });
            if (resp.ok) {
                showToast('Ponto de parada criado e salvo no disco com sucesso!', 'success');
                loadBackupsList();
                return;
            }
        } catch (e) {
            console.warn('API REST criar backup fallback local.', e);
        }

        try {
            let localBackups = [];
            const raw = localStorage.getItem('chn4_aton_backups_history');
            if (raw) localBackups = JSON.parse(raw);

            const now = new Date();
            localBackups.unshift({
                filename: null,
                createdAt: now.toISOString(),
                formattedDate: now.toLocaleString('pt-BR'),
                count: signalsData.length,
                note: note,
                signals: [...signalsData]
            });
            localStorage.setItem('chn4_aton_backups_history', JSON.stringify(localBackups.slice(0, 30)));
            showToast('Ponto de parada salvo localmente no navegador!', 'success');
            loadBackupsList();
        } catch (e) {
            showToast('Erro ao criar ponto de parada.', 'danger');
        }
    });

    window.restoreBackupPoint = async (filename, isLocal, localIndex) => {
        if (!confirm(`ATENÇÃO: Deseja restaurar o banco de dados para o Ponto de Parada escolhido?\n\nEsta ação irá atualizar o mapa e a lista de sinais em todos os dispositivos conectados.`)) {
            return;
        }

        let restoredSignals = null;

        if (filename && !isLocal) {
            try {
                const resp = await fetch('/api/backups/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: filename })
                });

                if (resp.ok) {
                    const resData = await resp.json();
                    if (resData.signals && Array.isArray(resData.signals)) {
                        restoredSignals = resData.signals;
                    }
                }
            } catch (e) {
                console.warn('Erro ao restaurar via REST API:', e);
            }
        }

        // If local backup was selected or REST API filename failed
        if (!restoredSignals && (isLocal || localIndex !== undefined)) {
            try {
                const raw = localStorage.getItem('chn4_aton_backups_history');
                if (raw) {
                    const localBackups = JSON.parse(raw);
                    const target = localIndex !== undefined && localIndex !== null && localBackups[localIndex] 
                        ? localBackups[localIndex] 
                        : localBackups.find(b => b.filename === filename || (!filename && b.signals));
                    
                    if (target && Array.isArray(target.signals) && target.signals.length > 0) {
                        restoredSignals = target.signals;
                        // Synchronize this local backup immediately to the server and signals.json!
                        try {
                            await fetch('/api/backups/restore', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ signals: target.signals, note: target.note || 'Restaurado do navegador' })
                            });
                        } catch (err) {
                            console.warn('Sync local backup to server warning:', err);
                        }
                    }
                }
            } catch (e) {
                console.error('Erro ao ler backup local:', e);
            }
        }

        if (restoredSignals && Array.isArray(restoredSignals) && restoredSignals.length > 0) {
            signalsData = restoredSignals;
            saveLocalCache();
            updateTypeFilterDropdown();
            updateIE();
            renderMapMarkers();
            renderSignalList();

            // Modo Visualizador: Restauração na nuvem desativada

            modalBackups?.classList.remove('active');
            showToast(`Base de dados restaurada com sucesso (${restoredSignals.length} sinais)!`, 'success');
        } else {
            showToast('Erro ao restaurar o ponto de parada selecionado.', 'danger');
        }
    };

    window.downloadBackupFile = (filename) => {
        window.open(`/api/backups/download?file=${encodeURIComponent(filename)}`, '_blank');
    };

    btnImportBackupFileTrigger?.addEventListener('click', () => inputBackupFile?.click());

    inputBackupFile?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                const restored = Array.isArray(parsed.signals) ? parsed.signals : (Array.isArray(parsed) ? parsed : null);
                if (!restored || restored.length === 0 || !restored[0].code) {
                    showToast('Arquivo de backup inválido ou sem sinais válidos.', 'danger');
                    return;
                }

                if (!confirm(`Confirmar restauração de ${restored.length} sinais a partir do arquivo [${file.name}]?`)) {
                    return;
                }

                signalsData = restored;
                saveLocalCache();
                updateTypeFilterDropdown();
                updateIE();
                renderMapMarkers();
                renderSignalList();

                try {
                    for (const sig of restored) {
                        saveSignalToBackend(sig);
                    }
                } catch (e) {}

                modalBackups?.classList.remove('active');
                showToast(`Base restaurada a partir do arquivo ${file.name}!`, 'success');
            } catch (err) {
                showToast('Erro ao ler o arquivo de backup.', 'danger');
            }
        };
        reader.readAsText(file);
    });

    // =========================================================================
    // 15. INITIAL BOOTSTRAP
    // =========================================================================
    async function init() {
        await loadSignalsFromBackend();
        setupRealtimeSync();
        updateRoute();
    }

    init();
});

// ==UserScript==
// @name         Flashcore Overlay
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Añade un botón circular para mostrar overlays de partidos en Flashcore con agrupación por liga
// @author       TuNombre
// @match        https://www.flashscore.es/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    // --- ESTILOS CSS PARA EL BOTÓN Y OVERLAY ---
    GM_addStyle(`
        /* Estilo del botón circular */
        .fc-overlay-btn {
            position: absolute;
            right: 10px;
            bottom: 10px;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background-color: #007bff;
            color: white;
            border: none;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        }
        .fc-overlay-btn:hover {
            background-color: #0056b3;
        }

        /* Contenedor del overlay */
        .fc-overlay {
            position: fixed;
            top: 50px;
            left: 50px;
            z-index: 2147483647;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 20px rgba(0,0,0,0.8);
            background-color: #000000 !important;
            min-width: 400px;
            border: 1px solid #333;
            cursor: default !important;
        }

        .fc-overlay .fc-overlay-btn {
            display: none !important;
        }

        /* Para asegurarse de que el overlay esté siempre visible */
        .fc-overlay.always-on-top {
            z-index: 2147483647 !important;
        }

        /* Estilo para el contenedor interno del overlay */
        .fc-overlay-inner {
            width: 100%;
            height: 100%;
            overflow: auto;
            background-color: #000000;
            cursor: default !important;
        }

        /* Estilo para el encabezado de la liga */
        .fc-overlay-header {
            padding: 8px 12px;
            background: #1a1a1a;
            border-bottom: 1px solid #333;
            color: white;
            font-weight: bold;
            font-size: 12px;
            cursor: default !important;
        }

        /* Contenedor de partidos */
        .fc-matches-container {
            padding: 10px;
            background-color: #000000;
            cursor: default !important;
        }

        /* Ocultar elementos no deseados en el overlay */
        .fc-overlay .headerLeague__star,
        .fc-overlay .wizard__relativeWrapper,
        .fc-overlay .headerLeague__actions,
        .fc-overlay .anclar-partido-btn,
        .fc-overlay .wcl-favorite_ggUc2,
        .fc-overlay .wcl-pin_J5btx,
        .fc-overlay .wcl-accordion_7Fi80 {
            display: none !important;
        }

        /* Prevenir cualquier interacción con clics simples */
        .fc-overlay a {
            pointer-events: none !important;
        }

        .fc-overlay .eventRowLink {
            display: none !important;
        }

        /* Hacer que los nombres de equipos sean clicables */
        .fc-overlay .event__participant--home,
        .fc-overlay .event__participant--away {
            cursor: pointer !important;
            pointer-events: auto !important;
        }

        .fc-overlay .event__participant--home:hover,
        .fc-overlay .event__participant--away:hover {
            text-decoration: underline;
        }

        /* Asegurar que los partidos se muestren correctamente */
        .fc-overlay .event__match {
            display: grid !important;
            grid-template-columns: 30px auto 1fr auto 30px 40px;
            grid-template-rows: auto auto;
            align-items: center;
            padding: 8px 10px;
            background-color: #000000;
            min-height: 60px;
            gap: 4px;
            width: 100%;
            box-sizing: border-box;
            margin-bottom: 5px;
            border-bottom: 1px solid #333;
            cursor: default !important;
        }

        .fc-overlay .event__match:last-child {
            border-bottom: none;
        }

        /* Estilos específicos para elementos del partido */
        .fc-overlay .event__stage {
            grid-column: 1;
            grid-row: 1 / span 2;
            color: #ff4444 !important;
            font-size: 11px;
            text-align: center;
            white-space: nowrap;
        }

        .fc-overlay .event__logo--home {
            grid-column: 2;
            grid-row: 1;
            width: 20px;
            height: 20px;
        }

        .fc-overlay .event__participant--home {
            grid-column: 3;
            grid-row: 1;
            color: #ffffff !important;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .fc-overlay .event__score--home {
            grid-column: 4;
            grid-row: 1;
            color: #ffffff !important;
            font-size: 14px;
            font-weight: bold;
            text-align: center;
        }

        .fc-overlay .event__part--home {
            grid-column: 5;
            grid-row: 1;
            color: #cccccc !important;
            font-size: 11px;
            text-align: center;
        }

        .fc-overlay .event__logo--away {
            grid-column: 2;
            grid-row: 2;
            width: 20px;
            height: 20px;
        }

        .fc-overlay .event__participant--away {
            grid-column: 3;
            grid-row: 2;
            color: #ffffff !important;
            font-size: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .fc-overlay .event__score--away {
            grid-column: 4;
            grid-row: 2;
            color: #ffffff !important;
            font-size: 14px;
            font-weight: bold;
            text-align: center;
        }

        .fc-overlay .event__part--away {
            grid-column: 5;
            grid-row: 2;
            color: #cccccc !important;
            font-size: 11px;
            text-align: center;
        }

        .fc-overlay .event__icon--tv {
            grid-column: 6;
            grid-row: 1 / span 2;
            align-self: center;
            justify-self: center;
        }

        /* Estilo para el botón de cerrar con cursor normal */
        .fc-close-btn {
            cursor: default !important;
        }
    `);

    // --- VARIABLES GLOBALES ---
    let isDragging = false;
    let dragOffset = { x: 0, y: 0 };
    let dragTarget = null;
    let clickStartTime = 0;
    let clickStartX = 0;
    let clickStartY = 0;
    const leagueOverlays = new Map();

    // --- FUNCIONES DE CLONADO CON ESTILOS ---

    // Función para obtener los estilos computados de un elemento y convertirlos a texto CSS
    function getComputedStyleText(element) {
        const computed = getComputedStyle(element);
        let styleText = '';

        // Copiar todas las propiedades CSS
        for (let i = 0; i < computed.length; i++) {
            const prop = computed[i];
            // Excluir algunas propiedades que pueden causar problemas
            if (!['width', 'height', 'position', 'top', 'left', 'right', 'bottom', 'z-index'].includes(prop)) {
                const value = computed.getPropertyValue(prop);
                if (value) {
                    styleText += `${prop}:${value};`;
                }
            }
        }

        return styleText;
    }

    // Función para clonar un elemento y todos sus hijos con estilos computados
    function cloneWithStyles(element) {
        const clone = element.cloneNode(false);

        // Aplicar estilos computados al clon
        clone.setAttribute('style', getComputedStyleText(element));

        // Clonar todos los hijos recursivamente
        for (let i = 0; i < element.childNodes.length; i++) {
            const child = element.childNodes[i];

            if (child.nodeType === Node.ELEMENT_NODE) {
                clone.appendChild(cloneWithStyles(child));
            } else if (child.nodeType === Node.TEXT_NODE) {
                clone.appendChild(document.createTextNode(child.textContent));
            }
        }

        return clone;
    }

    // Función para obtener el identificador único de una liga
    function getLeagueIdentifier(leagueHeader) {
        if (!leagueHeader) return null;

        const titleElement = leagueHeader.querySelector('.headerLeague__title-text');
        const categoryElement = leagueHeader.querySelector('.headerLeague__category-text');

        if (titleElement && categoryElement) {
            return `${categoryElement.textContent}:${titleElement.textContent}`;
        }

        return leagueHeader.textContent;
    }

    // --- FUNCIONES PRINCIPALES ---

    // Función para crear el botón circular en cada partido
    function createOverlayButton(matchElement) {
        if (matchElement.querySelector('.fc-overlay-btn')) {
            return;
        }

        const btn = document.createElement('button');
        btn.className = 'fc-overlay-btn';
        btn.textContent = '⬚';
        btn.title = 'Abrir overlay del partido';

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            e.preventDefault();
            createOverlay(matchElement);
        });

        matchElement.style.position = 'relative';
        matchElement.appendChild(btn);
    }

    // Función para crear o actualizar el overlay con el contenido del partido
    function createOverlay(matchElement) {
        const leagueContainer = matchElement.closest('.leagues--live') || matchElement.closest('.event');
        let leagueHeader = null;

        if (leagueContainer) {
            leagueHeader = leagueContainer.querySelector('.headerLeague__body');
        }

        const leagueId = getLeagueIdentifier(leagueHeader);

        // Si ya existe un overlay para esta liga, agregar el partido a él
        if (leagueId && leagueOverlays.has(leagueId)) {
            const existingOverlay = leagueOverlays.get(leagueId);
            addMatchToOverlay(existingOverlay, matchElement);
            bringToFront(existingOverlay);
            return;
        }

        // Crear un nuevo overlay
        const overlay = document.createElement('div');
        overlay.className = 'fc-overlay always-on-top';

        const overlayInner = document.createElement('div');
        overlayInner.className = 'fc-overlay-inner';

        // Agregar encabezado de la liga si existe
        if (leagueHeader) {
            const headerClone = cloneWithStyles(leagueHeader);

            // Eliminar elementos no deseados del encabezado
            const unwantedElements = headerClone.querySelectorAll('.headerLeague__star, .wizard__relativeWrapper, .headerLeague__actions');
            unwantedElements.forEach(el => el.remove());

            const headerContainer = document.createElement('div');
            headerContainer.className = 'fc-overlay-header';
            headerContainer.appendChild(headerClone);
            overlayInner.appendChild(headerContainer);
        }

        // Contenedor para los partidos
        const matchesContainer = document.createElement('div');
        matchesContainer.className = 'fc-matches-container';
        overlayInner.appendChild(matchesContainer);

        overlay.appendChild(overlayInner);
        document.body.appendChild(overlay);

        // Guardar referencia al overlay
        if (leagueId) {
            leagueOverlays.set(leagueId, overlay);
        }

        // Agregar el partido al overlay
        addMatchToOverlay(overlay, matchElement);

        // --- CONFIGURAR DRAG AND DROP MEJORADO ---
        overlay.addEventListener('mousedown', function(e) {
            if (e.button === 0) {
                clickStartTime = Date.now();
                clickStartX = e.clientX;
                clickStartY = e.clientY;
                isDragging = false;

                // Solo iniciar drag después de un pequeño delay y movimiento
                setTimeout(() => {
                    if (isDragging) {
                        dragTarget = overlay;
                        dragOffset.x = e.clientX - overlay.getBoundingClientRect().left;
                        dragOffset.y = e.clientY - overlay.getBoundingClientRect().top;
                        bringToFront(overlay);
                    }
                }, 100);

                e.preventDefault();
            }
        });

        overlay.addEventListener('mousemove', function(e) {
            if (clickStartTime > 0) {
                const moveX = Math.abs(e.clientX - clickStartX);
                const moveY = Math.abs(e.clientY - clickStartY);

                if (moveX > 5 || moveY > 5) {
                    isDragging = true;
                }
            }
        });

        // --- DOBLE CLIC PARA ABRIR ENLACE ---
        overlay.addEventListener('dblclick', function(e) {
            const link = matchElement.querySelector('a.eventRowLink');
            if (link && link.href) {
                window.open(link.href, '_blank');
            }
            bringToFront(overlay);
            e.preventDefault();
        });

        // --- CERRAR CON BOTÓN DERECHO ---
        overlay.addEventListener('contextmenu', function(e) {
            if (leagueId) {
                leagueOverlays.delete(leagueId);
            }
            document.body.removeChild(overlay);
            e.preventDefault();
        });

        // --- PREVENIR CLIC SIMPLE ---
        overlay.addEventListener('click', function(e) {
            const currentTime = Date.now();
            const moveX = Math.abs(e.clientX - clickStartX);
            const moveY = Math.abs(e.clientY - clickStartY);

            // Solo es un clic simple si no hubo movimiento significativo
            if (currentTime - clickStartTime < 300 && moveX < 5 && moveY < 5) {
                bringToFront(overlay);
                e.preventDefault();
                e.stopPropagation();
            }
        });

        overlay.addEventListener('mouseup', function() {
            clickStartTime = 0;
            isDragging = false;
        });
    }

    // Función para agregar un partido a un overlay existente
    function addMatchToOverlay(overlay, matchElement) {
        const matchesContainer = overlay.querySelector('.fc-matches-container');
        if (!matchesContainer) return;

        // Clonar el partido completo con todos sus estilos
        const matchClone = cloneWithStyles(matchElement);

        // Remover el botón de overlay del clon para evitar duplicados
        const btnClone = matchClone.querySelector('.fc-overlay-btn');
        if (btnClone) {
            btnClone.remove();
        }

        // Remover el enlace principal para prevenir navegación accidental
        const rowLink = matchClone.querySelector('.eventRowLink');
        if (rowLink) {
            rowLink.remove();
        }

        // Remover botones de favoritos y otros elementos no deseados
        const unwantedElements = matchClone.querySelectorAll('.wcl-favorite_ggUc2, .anclar-partido-btn');
        unwantedElements.forEach(el => el.remove());

        // Asegurar que el overlay tenga el ancho adecuado
        matchClone.style.width = '100%';
        matchClone.style.boxSizing = 'border-box';

        // Agregar funcionalidad de click en los nombres de equipos
        addTeamClickHandlers(matchClone, matchElement);

        matchesContainer.appendChild(matchClone);
    }

    // Función para normalizar nombres de equipos (eliminar acentos y caracteres especiales)
    function normalizeTeamName(name) {
        return name.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
            .replace(/\s+/g, '-')
            .replace(/[^a-z0-9-]/g, '');
    }

    // Función para extraer los IDs de ambos equipos desde la URL del partido
    function getTeamIdsFromMatch(matchElement) {
        const matchLink = matchElement.querySelector('.eventRowLink');
        if (!matchLink || !matchLink.href) return null;

        // La URL tiene formato: /partido/.../equipo1-id1/equipo2-id2/
        // Ejemplo: /partido/.../atletico-madrid-jaarqpLQ/galatasaray-riaqqurF/
        const urlParts = matchLink.href.split('/');

        // Buscar los segmentos que contienen guion y parecen ser "nombre-id"
        const teamSegments = urlParts.filter(part => {
            // Un segmento válido tiene al menos un guion y no está vacío
            return part && part.includes('-') && part.length > 5;
        });

        if (teamSegments.length < 2) return null;

        // Los últimos dos segmentos antes de los parámetros son los equipos
        const team1Segment = teamSegments[teamSegments.length - 2];
        const team2Segment = teamSegments[teamSegments.length - 1].split('?')[0]; // Remover query params

        // Extraer nombre e ID de cada segmento
        // Formato: "nombre-nombre-id" donde el ID es el último segmento después del último guion
        const extractTeamInfo = (segment) => {
            const lastDashIndex = segment.lastIndexOf('-');
            if (lastDashIndex === -1) return null;

            const name = segment.substring(0, lastDashIndex);
            const id = segment.substring(lastDashIndex + 1);

            return { name: name, id: id };
        };

        const team1 = extractTeamInfo(team1Segment);
        const team2 = extractTeamInfo(team2Segment);

        if (!team1 || !team2) return null;

        return { team1, team2 };
    }

    // Función para encontrar el ID de un equipo específico comparando nombres
    function findTeamId(matchElement, teamName) {
        const teamIds = getTeamIdsFromMatch(matchElement);
        if (!teamIds) return null;

        const normalizedSearchName = normalizeTeamName(teamName);

        // Extraer palabras clave del nombre buscado (ignorar palabras comunes)
        const commonWords = ['de', 'del', 'la', 'los', 'las', 'el', 'fc', 'cf', 'ud', 'cd'];
        const searchWords = normalizedSearchName.split('-').filter(word =>
            word.length > 2 && !commonWords.includes(word)
        );

        // Función para contar coincidencias de palabras
        const countMatches = (urlName, searchWords) => {
            let matches = 0;
            searchWords.forEach(word => {
                if (urlName.includes(word)) matches++;
            });
            return matches;
        };

        const matches1 = countMatches(teamIds.team1.name, searchWords);
        const matches2 = countMatches(teamIds.team2.name, searchWords);

        // Devolver el equipo con más coincidencias
        // Devolver tanto el ID como el nombre que usa Flashscore en la URL
        if (matches1 > matches2 && matches1 > 0) {
            return { id: teamIds.team1.id, urlName: teamIds.team1.name };
        }
        if (matches2 > matches1 && matches2 > 0) {
            return { id: teamIds.team2.id, urlName: teamIds.team2.name };
        }

        // Si hay empate o no hay coincidencias, intentar coincidencia exacta
        if (teamIds.team1.name === normalizedSearchName) {
            return { id: teamIds.team1.id, urlName: teamIds.team1.name };
        }
        if (teamIds.team2.name === normalizedSearchName) {
            return { id: teamIds.team2.id, urlName: teamIds.team2.name };
        }

        return null;
    }

    // Función para agregar manejadores de click a los nombres de equipos
    function addTeamClickHandlers(matchClone, originalMatch) {
        const homeParticipant = matchClone.querySelector('.event__participant--home') ||
                               matchClone.querySelector('.event__homeParticipant');
        const awayParticipant = matchClone.querySelector('.event__participant--away') ||
                               matchClone.querySelector('.event__awayParticipant');

        if (homeParticipant) {
            const homeName = homeParticipant.textContent.trim();
            const homeTeamData = findTeamId(originalMatch, homeName);

            if (homeTeamData) {
                homeParticipant.addEventListener('dblclick', function(e) {
                    e.stopPropagation();
                    e.preventDefault();

                    // Usar el nombre que Flashscore usa en su URL, no el normalizado
                    const teamUrl = `https://www.flashscore.es/equipo/${homeTeamData.urlName}/${homeTeamData.id}/`;
                    window.open(teamUrl, '_blank');
                });
            }
        }

        if (awayParticipant) {
            const awayName = awayParticipant.textContent.trim();
            const awayTeamData = findTeamId(originalMatch, awayName);

            if (awayTeamData) {
                awayParticipant.addEventListener('dblclick', function(e) {
                    e.stopPropagation();
                    e.preventDefault();

                    // Usar el nombre que Flashscore usa en su URL, no el normalizado
                    const teamUrl = `https://www.flashscore.es/equipo/${awayTeamData.urlName}/${awayTeamData.id}/`;
                    window.open(teamUrl, '_blank');
                });
            }
        }
    }

    // Función para traer un overlay al frente
    function bringToFront(overlay) {
        let maxZIndex = 2147483640;
        document.querySelectorAll('.fc-overlay').forEach(ov => {
            const zIndex = parseInt(window.getComputedStyle(ov).zIndex);
            if (zIndex > maxZIndex) maxZIndex = zIndex;
        });
        overlay.style.zIndex = (maxZIndex + 1).toString();
    }

    // Manejadores globales para el drag and drop
    document.addEventListener('mousemove', function(e) {
        if (isDragging && dragTarget) {
            dragTarget.style.left = (e.clientX - dragOffset.x) + 'px';
            dragTarget.style.top = (e.clientY - dragOffset.y) + 'px';
        }
    });

    document.addEventListener('mouseup', function() {
        isDragging = false;
        dragTarget = null;
    });

    // Función para agregar botones a todos los partidos visibles
    function addButtonsToAllMatches() {
        const matches = document.querySelectorAll('.event__match:not(.fc-processed)');
        matches.forEach(function(match) {
            match.classList.add('fc-processed');
            createOverlayButton(match);
        });
    }

    function handleExpandableSections() {
        const expandButtons = document.querySelectorAll('[data-testid="wcl-accordionButton"]');
        expandButtons.forEach(button => {
            if (!button.hasAttribute('data-fc-listener')) {
                button.setAttribute('data-fc-listener', 'true');
                button.addEventListener('click', function() {
                    setTimeout(addButtonsToAllMatches, 500);
                });
            }
        });
    }

    // --- OBSERVAR CAMBIOS EN EL DOM ---
    const observer = new MutationObserver(function(mutations) {
        let shouldCheckMatches = false;

        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                shouldCheckMatches = true;
                mutation.addedNodes.forEach(function(node) {
                    if (node.nodeType === 1 && node.classList && node.classList.contains('event__match')) {
                        node.classList.add('fc-processed');
                        createOverlayButton(node);
                    }
                });
            }
        });

        if (shouldCheckMatches) {
            setTimeout(addButtonsToAllMatches, 100);
        }

        handleExpandableSections();
    });

    // --- INICIALIZACIÓN ---
    function init() {
        addButtonsToAllMatches();
        handleExpandableSections();

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Mantener overlays en primer plano
    setInterval(() => {
        document.querySelectorAll('.fc-overlay').forEach(overlay => {
            const currentZIndex = parseInt(window.getComputedStyle(overlay).zIndex);
            if (currentZIndex < 2147483640) {
                overlay.style.zIndex = '2147483640';
            }
        });
    }, 1000);

    setInterval(addButtonsToAllMatches, 2000);
})();

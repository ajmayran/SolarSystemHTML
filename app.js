// Configuration
const USE_REALISTIC_SCALE = false;
const SHOW_ORBITS = true;
const SHOW_LABELS = true;
const ENABLE_TRAILS = false;
const ENABLE_ROTATION = false;

class CSS2DObject extends THREE.Object3D {
    constructor(element) {
        super();
        this.element = element;
        this.element.style.position = 'absolute';
        this.element.style.pointerEvents = 'none';

        this.addEventListener('removed', function () {
            this.element.parentNode.removeChild(this.element);
        });
    }

    copy(source, recursive) {
        super.copy(source, recursive);
        this.element = source.element.cloneNode(true);
        return this;
    }
}

// Global variables
let scene, camera, renderer, controls;
let sun, planets = [], orbits = [], labels = [], planetInfo = {};
let running = true;
let timeSpeed = 1.0;
let orbitVisible = SHOW_ORBITS;
let labelsVisible = SHOW_LABELS;
let trailsEnabled = ENABLE_TRAILS;
let autoRotate = ENABLE_ROTATION;
let rotationAngle = 0;
let infoPanel;
let clock = new THREE.Clock();
let labelRenderer;

// DOM elements
let pauseButton, orbitButton, labelButton, trailButton, rotationButton;
let speedSlider, speedValue;


// Initialize the scene
init();
// Start animation loop
animate();

function init() {
    // Create scene
    scene = new THREE.Scene();

    labelRenderer = new THREE.CSS2DRenderer();
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.domElement.style.position = 'absolute';
    labelRenderer.domElement.style.top = '0';
    labelRenderer.domElement.style.pointerEvents = 'none';
    document.getElementById('container').appendChild(labelRenderer.domElement);

    // Create camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.set(-40, 20, -40);

    // Create renderer
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    document.getElementById('container').appendChild(renderer.domElement);

    // Create controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.25;

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x333333);
    scene.add(ambientLight);

    // Add point light (sun)
    const sunLight = new THREE.PointLight(0xffffff, 1.5);
    sunLight.position.set(0, 0, 0);
    scene.add(sunLight);

    // Get DOM elements
    pauseButton = document.getElementById('pauseButton');
    orbitButton = document.getElementById('orbitButton');
    labelButton = document.getElementById('labelButton');
    trailButton = document.getElementById('trailButton');
    rotationButton = document.getElementById('rotationButton');
    resetButton = document.getElementById('resetButton');
    speedSlider = document.getElementById('speedSlider');
    speedValue = document.getElementById('speedValue');
    infoPanel = document.getElementById('info-panel');

    // Add event listeners
    pauseButton.addEventListener('click', toggleSimulation);
    orbitButton.addEventListener('click', toggleOrbits);
    labelButton.addEventListener('click', toggleLabels);
    trailButton.addEventListener('click', toggleTrails);
    rotationButton.addEventListener('click', toggleRotation);
    resetButton.addEventListener('click', resetView);
    speedSlider.addEventListener('input', updateSpeed);

    // Handle window resize
    window.addEventListener('resize', onWindowResize);

    // Create background stars
    createStars();

    // Create sun and planets
    createCelestialBodies();

    // Setup raycaster for object selection
    setupRaycaster();

    labels.forEach(label => {
        if (label instanceof CSS2DObject && !document.body.contains(label.element)) {
            document.body.appendChild(label.element);
        }
    });
}

function createStars() {
    const starsGeometry = new THREE.BufferGeometry();
    const starsMaterial = new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.1,
        transparent: true
    });

    const starsVertices = [];
    for (let i = 0; i < 3000; i++) {
        const x = Math.random() * 400 - 200;
        const y = Math.random() * 400 - 200;
        const z = Math.random() * 400 - 200;
        starsVertices.push(x, y, z);
    }

    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    const starField = new THREE.Points(starsGeometry, starsMaterial);
    scene.add(starField);
}

function createCelestialBodies() {
    // Define planet data
    const planetsData = !USE_REALISTIC_SCALE ? [
        { name: "Mercury", distance: 4, radius: 0.2, color: 0xaaaaaa, speed: 1.6, tilt: 0.03, hasRings: false },
        { name: "Venus", distance: 6, radius: 0.4, color: 0xf29646, speed: 1.2, tilt: 177.4, hasRings: false },
        { name: "Earth", distance: 8, radius: 0.5, color: 0x3b8eea, speed: 1.0, tilt: 23.4, hasRings: false },
        { name: "Mars", distance: 10, radius: 0.3, color: 0xcf3a06, speed: 0.8, tilt: 25.2, hasRings: false },
        { name: "Jupiter", distance: 14, radius: 1.1, color: 0xf29544, speed: 0.4, tilt: 3.1, hasRings: false },
        {
            name: "Saturn", distance: 18, radius: 0.9, color: 0xead7a7, speed: 0.3, tilt: 26.7, hasRings: true,
            rings: { inner: 1.2, outer: 2.0, color: 0xffffff }
        },
        {
            name: "Uranus", distance: 22, radius: 0.7, color: 0x5e98b5, speed: 0.2, tilt: 97.8, hasRings: true,
            rings: { inner: 1.1, outer: 1.7, color: 0xcccccc }
        },
        { name: "Neptune", distance: 26, radius: 0.7, color: 0x366ca3, speed: 0.1, tilt: 28.3, hasRings: false }
    ] : [
        // Realistic scale data here (can be added similar to visual scale)
        // Currently using visual scale only
    ];

    // Create Sun
    const sunRadius = 2.5;
    const sunGeometry = new THREE.SphereGeometry(sunRadius, 32, 32);
    const sunMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        emissive: 0xffff00,
        emissiveIntensity: 1
    });
    sun = new THREE.Mesh(sunGeometry, sunMaterial);
    scene.add(sun);

    // Create sun glow
    const glowGeometry = new THREE.SphereGeometry(sunRadius * 1.1, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
        color: 0xffff00,
        transparent: true,
        opacity: 0.2
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    scene.add(glow);

    // Create planets
    planetsData.forEach(planetData => {
        createPlanet(planetData);
    });

    // Create Earth's moon
    createMoon();

    // Create meteors
    createMeteors();
}

function createPlanet(data) {
    // Create planet
    const planetGeometry = new THREE.SphereGeometry(data.radius, 32, 32);
    const planetMaterial = new THREE.MeshLambertMaterial({ color: data.color });
    const planet = new THREE.Mesh(planetGeometry, planetMaterial);

    // Set initial position
    const angle = Math.random() * Math.PI * 2;
    planet.position.x = Math.cos(angle) * data.distance;
    planet.position.z = Math.sin(angle) * data.distance;

    // Add to scene
    scene.add(planet);

    // Create orbit
    const orbitGeometry = new THREE.BufferGeometry();
    const orbitMaterial = new THREE.LineBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.5 });
    const orbitPoints = [];
    for (let i = 0; i <= 100; i++) {
        const theta = (i / 100) * Math.PI * 2;
        orbitPoints.push(
            Math.cos(theta) * data.distance,
            0,
            Math.sin(theta) * data.distance
        );
    }
    orbitGeometry.setAttribute('position', new THREE.Float32BufferAttribute(orbitPoints, 3));
    const orbit = new THREE.Line(orbitGeometry, orbitMaterial);
    orbit.visible = orbitVisible;
    scene.add(orbit);
    orbits.push(orbit);

    // Create planet label
    const labelDiv = document.createElement('div');
    labelDiv.className = 'label';
    labelDiv.textContent = data.name;
    labelDiv.style.marginTop = '-1em';

    const label = new CSS2DObject(labelDiv);
    label.position.set(0, data.radius + 0.5, 0);
    planet.add(label);
    labels.push(label);
    document.body.appendChild(labelDiv);

    // Create rings if applicable
    let rings = [];
    if (data.hasRings && data.rings) {
        const { inner, outer, color } = data.rings;

        for (let i = 0; i < 8; i++) {
            const ringRadius = inner + i * ((outer - inner) / 8);
            const ringGeometry = new THREE.RingGeometry(
                ringRadius * data.radius,
                ringRadius * data.radius + 0.1,
                64
            );

            const ringMaterial = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0.7 - (i / 8) * 0.5,
                side: THREE.DoubleSide
            });

            const ring = new THREE.Mesh(ringGeometry, ringMaterial);
            ring.rotation.x = Math.PI / 2;
            planet.add(ring);
            rings.push(ring);
        }
    }

    // Add to planets array with orbit data
    planets.push({
        mesh: planet,
        distance: data.distance,
        speed: data.speed,
        angle: angle,
        name: data.name,
        hasRings: data.hasRings,
        rings: rings
    });

    // Store planet info for selection
    planetInfo[planet.id] = {
        name: data.name,
        distance: data.distance,
        diameter: data.radius * 2,
        period: 1 / data.speed
    };
}

function createMoon() {
    // Find Earth
    const earth = planets.find(p => p.name === "Earth");
    if (!earth) return;

    // Create moon
    const moonGeometry = new THREE.SphereGeometry(0.1, 32, 32);
    const moonMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const moon = new THREE.Mesh(moonGeometry, moonMaterial);

    // Add moon label
    const moonLabelDiv = document.createElement('div');
    moonLabelDiv.className = 'label';
    moonLabelDiv.textContent = "Moon";
    moonLabelDiv.style.marginTop = '-1em';

    const moonLabel = new CSS2DObject(moonLabelDiv);
    document.body.appendChild(moonLabelDiv);
    moonLabel.position.set(0, 0.2, 0);
    moon.add(moonLabel);
    labels.push(moonLabel);

    // Add to scene
    scene.add(moon);

    // Add to planets array with special moon flag
    planets.push({
        mesh: moon,
        distance: 0.7, // Distance from Earth
        speed: 7,
        angle: 0,
        name: "Moon",
        isMoon: true,
        parentName: "Earth"
    });
}

function createMeteors() {
    // Create 3 meteors
    for (let i = 0; i < 3; i++) {
        const meteorGeometry = new THREE.SphereGeometry(0.15, 16, 16);
        const meteorMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, emissive: 0xffffff });
        const meteor = new THREE.Mesh(meteorGeometry, meteorMaterial);

        // Set random position and velocity
        meteor.position.set(
            -50 + Math.random() * 20,
            -10 + Math.random() * 20,
            -10 + Math.random() * 20
        );

        // Add to scene
        scene.add(meteor);

        // Add to planets array with special meteor flag
        planets.push({
            mesh: meteor,
            velocity: new THREE.Vector3(
                1.0 + Math.random(),
                -0.2 + Math.random() * 0.4,
                -0.2 + Math.random() * 0.4
            ),
            isMeteor: true
        });

        // Create meteor trail
        const trailGeometry = new THREE.BufferGeometry();
        const trailMaterial = new THREE.LineBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.5
        });
        const trail = new THREE.Line(trailGeometry, trailMaterial);
        trail.visible = trailsEnabled;
        scene.add(trail);

        // Store trail reference
        meteor.userData.trail = trail;
        meteor.userData.trailPoints = [];
    }
}

function setupRaycaster() {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Mouse move for hover effect
    window.addEventListener('mousemove', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);

        document.body.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
    });

    // Click event for planet info
    window.addEventListener('click', (event) => {
        mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(scene.children);

        if (intersects.length > 0) {
            const object = intersects[0].object;

            // Check if it's the sun
            if (object === sun) {
                showInfoPanel(
                    "Sun\nThe center of our solar system\nDiameter: 1,391,000 km\nSurface Temperature: 5,500°C",
                    event.clientX,
                    event.clientY
                );
                return;
            }

            // Check if it's a planet
            if (planetInfo[object.id]) {
                const info = planetInfo[object.id];
                showInfoPanel(
                    `${info.name}\nDistance from Sun: ${info.distance} units\nDiameter: ${info.diameter} units\nOrbital Period: ${info.period.toFixed(2)} Earth years`,
                    event.clientX,
                    event.clientY
                );
            } else {
                hideInfoPanel();
            }
        } else {
            hideInfoPanel();
        }
    });
}

function showInfoPanel(text, x, y) {
    infoPanel.textContent = text;
    infoPanel.style.display = 'block';
    infoPanel.style.left = `${x + 20}px`;
    infoPanel.style.top = `${y - 20}px`;
}

function hideInfoPanel() {
    infoPanel.style.display = 'none';
}

// In the animate function, add this code to handle your custom labels
function animate() {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();

    if (running) {
        updatePlanets(delta);

        if (autoRotate) {
            rotationAngle += 0.005 * timeSpeed;
            camera.position.x = 40 * Math.sin(rotationAngle);
            camera.position.z = 40 * Math.cos(rotationAngle);
            camera.lookAt(scene.position);
        }
    }

    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);

    // Add this code to handle your custom labels:
    labels.forEach(label => {
        if (label instanceof CSS2DObject) {
            const position = new THREE.Vector3();
            const quaternion = new THREE.Quaternion();
            const scale = new THREE.Vector3();

            label.matrixWorld.decompose(position, quaternion, scale);

            const widthHalf = window.innerWidth / 2;
            const heightHalf = window.innerHeight / 2;

            position.project(camera);

            position.x = (position.x * widthHalf) + widthHalf;
            position.y = -(position.y * heightHalf) + heightHalf;

            label.element.style.left = position.x + 'px';
            label.element.style.top = position.y + 'px';
        }
    });
}

function updatePlanets(delta) {
    // Update each planet
    planets.forEach(planet => {
        if (planet.isMeteor) {
            // Update meteor position
            planet.mesh.position.add(planet.velocity.clone().multiplyScalar(timeSpeed * delta));

            // Check if meteor is out of bounds
            if (planet.mesh.position.x > 50) {
                planet.mesh.position.set(
                    -50 + Math.random() * 20,
                    -10 + Math.random() * 20,
                    -10 + Math.random() * 20
                );

                // Clear trail
                const trail = planet.mesh.userData.trail;
                if (trail) {
                    planet.mesh.userData.trailPoints = [];
                    trail.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
                }
            }

            // Update trail
            if (trailsEnabled) {
                const trail = planet.mesh.userData.trail;
                if (trail) {
                    const points = planet.mesh.userData.trailPoints;
                    points.push(
                        planet.mesh.position.x,
                        planet.mesh.position.y,
                        planet.mesh.position.z
                    );

                    // Limit trail length
                    if (points.length > 300) {
                        points.splice(0, 3);
                    }

                    trail.geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
                }
            }
        } else if (planet.isMoon) {
            // Find parent planet (Earth)
            const parent = planets.find(p => p.name === planet.parentName);
            if (parent) {
                planet.angle += planet.speed * timeSpeed * delta;

                // Calculate moon position relative to Earth
                planet.mesh.position.x = parent.mesh.position.x + Math.cos(planet.angle) * planet.distance;
                planet.mesh.position.z = parent.mesh.position.z + Math.sin(planet.angle) * planet.distance;
            }
        } else {
            // Update regular planet
            planet.angle += planet.speed * timeSpeed * delta;

            // Update position
            planet.mesh.position.x = Math.cos(planet.angle) * planet.distance;
            planet.mesh.position.z = Math.sin(planet.angle) * planet.distance;
        }
    });
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
}

// Control functions
function toggleSimulation() {
    running = !running;
    pauseButton.textContent = running ? 'Pause' : 'Resume';
}

function toggleOrbits() {
    orbitVisible = !orbitVisible;
    orbits.forEach(orbit => {
        orbit.visible = orbitVisible;
    });
}

function toggleLabels() {
    labelsVisible = !labelsVisible;

    // Handle THREE.CSS2DObject labels (moon)
    labels.forEach(label => {
        if (label instanceof THREE.CSS2DObject) {
            label.visible = labelsVisible;
        }
    });

    // Handle custom CSS2DObject labels (planets)
    labels.forEach(label => {
        if (label instanceof CSS2DObject) {
            label.element.style.display = labelsVisible ? 'block' : 'none';
        }
    });
}

function toggleTrails() {
    trailsEnabled = !trailsEnabled;
    planets.forEach(planet => {
        if (planet.isMeteor && planet.mesh.userData.trail) {
            planet.mesh.userData.trail.visible = trailsEnabled;
        }
    });
}

function toggleRotation() {
    autoRotate = !autoRotate;
    controls.enabled = !autoRotate;
}

function resetView() {
    camera.position.set(-40, 20, -40);
    camera.lookAt(scene.position);
    controls.reset();
}

function updateSpeed() {
    timeSpeed = speedSlider.value;
    speedValue.textContent = timeSpeed;
}

// Add CSS2DRenderer and CSS2DObject for labels
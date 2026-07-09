import {
  Scene, WebGLRenderer, PerspectiveCamera, Color, Group, Vector3,
  Mesh, ExtrudeGeometry, MeshStandardMaterial,
  InstancedMesh, BoxGeometry, Object3D,
  AmbientLight, DirectionalLight,
  ShaderMaterial, SphereGeometry, BackSide,
} from 'three';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { animate, createTimeline, createTimer, stagger, utils } from 'animejs';
import { getInstances } from 'animejs/adapters/three';

// ---------------------------------------------------------------------------
// ctba logo intro — a Three.js + anime.js entrance animation.
//
// The mark is two red "step" squares followed by the lowercase "ctba"
// wordmark, extruded into 3D and animated onto a tile floor.
// ---------------------------------------------------------------------------

const RED = '#FF2D2D';
const INK = '#141414';
const BG = '#1c1b1a';
const SKY_TOP = '#6f6e73';
const SKY_BOTTOM = '#a9a8ac';

const TEXT = 'ctba';
const LETTER_SIZE = 1;
const DEPTH = 0.28;
const FONT_URL = 'https://unpkg.com/three@0.184.0/examples/fonts/helvetiker_bold.typeface.json';

// -- Scene / renderer --------------------------------------------------------

const scene = new Scene();
scene.background = new Color(BG);

const skyMaterial = new ShaderMaterial({
  uniforms: {
    topColor: { value: new Color(SKY_TOP) },
    bottomColor: { value: new Color(SKY_BOTTOM) },
    offset: { value: -20 },
    exponent: { value: 0.9 },
  },
  side: BackSide,
  fog: false,
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    uniform float offset;
    uniform float exponent;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
      gl_FragColor = vec4(mix(bottomColor, topColor, pow(max(h, 0.0), exponent)), 1.0);
      #include <colorspace_fragment>
    }
  `,
});
scene.add(new Mesh(new SphereGeometry(500, 32, 15), skyMaterial));

const ambient = new AmbientLight(0xffffff, 0.7);
scene.add(ambient);
const keyLight = new DirectionalLight(0xffffff, 1.5);
keyLight.position.set(80, 160, 220);
scene.add(keyLight);
const rimLight = new DirectionalLight(0xaab8ff, 0.5);
rimLight.position.set(-150, -40, 120);
scene.add(rimLight);

const camera = new PerspectiveCamera(35, innerWidth / innerHeight, 0.01, 100);
const cameraRig = new Group();
cameraRig.add(camera);
scene.add(cameraRig);

const renderer = new WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio || 1);
document.body.appendChild(renderer.domElement);
renderer.domElement.style.opacity = '0';

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

createTimer({
  onUpdate: () => renderer.render(scene, camera),
});

// -- Floor: instanced tile grid ----------------------------------------------

const FLOOR_COLS = 25;
const FLOOR_ROWS = 25;
const TILE = 1;

const floorGroup = new Group();
const floorMat = new MeshStandardMaterial({ color: '#dcdce0', roughness: 0.7, metalness: 0.05 });
const floor = new InstancedMesh(new BoxGeometry(TILE, TILE, TILE), floorMat, FLOOR_COLS * FLOOR_ROWS);
const dummy = new Object3D();
for (let r = 0; r < FLOOR_ROWS; r++) {
  for (let c = 0; c < FLOOR_COLS; c++) {
    dummy.position.set(c - (FLOOR_COLS - 1) / 2, 0, r - (FLOOR_ROWS - 1) / 2);
    dummy.updateMatrix();
    floor.setMatrixAt(r * FLOOR_COLS + c, dummy.matrix);
  }
}
floorGroup.add(floor);
scene.add(floorGroup);
const tiles = getInstances(floor);

// -- Logo mark: two red "step" squares ---------------------------------------

const squareGroup = new Group();
const squareMat = new MeshStandardMaterial({ color: new Color(RED), roughness: 0.4, metalness: 0.1 });
const SQ = 0.62;

const squareTopLeft = new Mesh(new BoxGeometry(SQ, SQ, DEPTH), squareMat);
squareTopLeft.position.set(0, 1.02, 0);

const squareBottomRight = new Mesh(new BoxGeometry(SQ, SQ, DEPTH), squareMat);
squareBottomRight.position.set(SQ * 0.78, 0.34, 0);

squareGroup.add(squareTopLeft, squareBottomRight);

// -- Logo mark: "ctba" wordmark, extruded letter by letter -------------------

const letterGroup = new Group();
const letterMeshes = [];

async function buildWordmark() {
  const loader = new FontLoader();
  const fontData = await loader.loadAsync(FONT_URL);

  const inkMat = new MeshStandardMaterial({ color: new Color(INK), roughness: 0.4, metalness: 0.1 });
  const unitsPerEm = fontData.data.resolution;
  let cursor = SQ * 1.55;

  for (const char of TEXT) {
    const glyph = fontData.data.glyphs[char];
    const shapes = fontData.generateShapes(char, LETTER_SIZE);
    const geom = shapes.length
      ? new ExtrudeGeometry(shapes, { depth: DEPTH, bevelEnabled: false })
      : null;

    const mesh = new Mesh(geom || new BoxGeometry(0.0001, 0.0001, 0.0001), inkMat);
    mesh.position.set(cursor, 0, 0);
    mesh.userData.restX = cursor;
    letterMeshes.push(mesh);
    letterGroup.add(mesh);

    cursor += ((glyph?.ha ?? unitsPerEm * 0.6) / unitsPerEm) * LETTER_SIZE;
  }

  return cursor;
}

// -- Assemble the logo, centered on the floor --------------------------------

const logoGroup = new Group();
logoGroup.add(squareGroup, letterGroup);
scene.add(logoGroup);

buildWordmark().then((wordmarkWidth) => {
  const totalWidth = wordmarkWidth;
  logoGroup.position.x = -totalWidth / 2;
  logoGroup.position.y = TILE / 2;
  runIntro();
});

// -- Animation ---------------------------------------------------------------

function runIntro() {
  // Initial poses: everything starts hidden / off-stage.
  utils.set(camera, { x: 0, y: 5.2, z: 16, rotateX: -8, fov: 45, zoom: 1 });
  utils.set(cameraRig, { rotateY: 0 });

  utils.set(squareTopLeft, { y: squareTopLeft.position.y + 14, scale: 0 });
  utils.set(squareBottomRight, { y: squareBottomRight.position.y + 14, scale: 0 });

  letterMeshes.forEach((m) => utils.set(m, {
    y: -3,
    scaleY: 0.1,
    transformOrigin: '0 -0.5 0',
  }));

  const tl = createTimeline({ id: 'ctba intro', autoplay: false })
    .add(renderer.domElement, {
      opacity: [0, 1],
      duration: 900, ease: 'inOut(2)',
    }, 0)
    .add(camera, {
      y: [{ to: 6.2, duration: 1200, ease: 'inOut(2)' }],
      rotateX: [{ to: -4, duration: 1200, ease: 'inOut(2)' }],
    }, 200)
    .add(tiles, {
      y: { from: -6, to: 0, duration: 900, delay: stagger(18, { grid: true, from: 'center' }), ease: 'outExpo' },
    }, 0)
    .label('POP', 1500)
    .add(squareTopLeft, {
      y: { to: 1.02, duration: 620, ease: 'outBounce' },
      scale: { to: 1, duration: 350, ease: 'outElastic(1.2, 0.6)' },
    }, 'POP')
    .add(squareBottomRight, {
      y: { to: 0.34, duration: 620, ease: 'outBounce' },
      scale: { to: 1, duration: 350, ease: 'outElastic(1.2, 0.6)' },
    }, 'POP+=120')
    .add(letterMeshes, {
      y: { to: 0, duration: 480, ease: 'outElastic(1.1, 0.7)' },
      scaleY: { to: 1, duration: 420, ease: 'outQuad' },
      delay: stagger(70),
    }, 'POP+=260')
    .add(logoGroup, {
      scale: [{ from: 1.08, to: 1, duration: 500, ease: 'outElastic(1.3, 0.5)' }],
    }, 'POP+=260')
    .add(cameraRig, {
      rotateY: { from: -18, to: 0, duration: 1600, ease: 'inOut(2)' },
    }, 'POP')
    .add(camera, {
      zoom: [{ to: 1.12, duration: 900, ease: 'inOut(2)' }, { to: 1, duration: 700, delay: 1400, ease: 'inOut(2)' }],
    }, 'POP+=200')
    .init();

  animate(tl, {
    currentTime: [{ to: () => tl.duration, duration: () => tl.duration, ease: 'linear' }],
    duration: tl.duration,
    loop: true,
  });
}

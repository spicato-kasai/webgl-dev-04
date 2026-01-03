import * as THREE from "../lib/three.module.js";

window.addEventListener(
	"DOMContentLoaded",
	() => {
		const wrapper = document.querySelector("#webgl");
		const app = new ThreeApp(wrapper);
		app.init();
		app.render();
	},
	false
);

class ThreeApp {
	/**
	 * カメラ定義のための定数
	 */
	static CAMERA_PARAM = {
		fovy: 60,
		aspect: window.innerWidth / window.innerHeight,
		near: 0.1,
		far: 50.0,
		position: new THREE.Vector3(0.0, 0.0, 2.0),
		lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
	};
	/**
	 * レンダラー定義のための定数
	 */
	static RENDERER_PARAM = {
		clearColor: 0x000000,
		width: window.innerWidth,
		height: window.innerHeight,
	};

	wrapper; // canvas の親要素
	renderer; // レンダラ
	scene; // シーン
	camera; // カメラ
	plane; // 板ポリゴン
	mouse; // マウス位置（正規化座標）
	targetMouse; // マウスの目標位置
	texture; // 写真のテクスチャ
	isMouseOver; // マウスがポリゴン上にあるか

	/**
	 * コンストラクタ
	 * @constructor
	 * @param {HTMLElement} wrapper - canvas 要素を append する親要素
	 */
	constructor(wrapper) {
		this.wrapper = wrapper;

		// マウス位置の初期化
		this.mouse = new THREE.Vector2(0.5, 0.5);
		this.targetMouse = new THREE.Vector2(0.5, 0.5);
		this.isMouseOver = false;

		// this のバインド
		this.render = this.render.bind(this);

		// ウィンドウのリサイズを検出できるようにする
		window.addEventListener(
			"resize",
			() => {
				this.renderer.setSize(window.innerWidth, window.innerHeight);
				this.camera.aspect = window.innerWidth / window.innerHeight;
				this.camera.updateProjectionMatrix();
			},
			false
		);
	}

	/**
	 * 初期化処理
	 */
	init() {
		// レンダラー
		const color = new THREE.Color(ThreeApp.RENDERER_PARAM.clearColor);
		this.renderer = new THREE.WebGLRenderer();
		this.renderer.setClearColor(color);
		this.renderer.setSize(ThreeApp.RENDERER_PARAM.width, ThreeApp.RENDERER_PARAM.height);
		this.wrapper.appendChild(this.renderer.domElement);

		// マウスイベントの設定
		this.renderer.domElement.addEventListener("mousemove", (e) => {
			const rect = this.renderer.domElement.getBoundingClientRect();
			this.targetMouse.x = (e.clientX - rect.left) / rect.width;
			this.targetMouse.y = 1.0 - (e.clientY - rect.top) / rect.height;
			this.isMouseOver = true;
		});

		// マウスが外れたときのイベント
		this.renderer.domElement.addEventListener("mouseleave", () => {
			this.isMouseOver = false;
		});

		// シーン
		this.scene = new THREE.Scene();

		// カメラ
		this.camera = new THREE.PerspectiveCamera(ThreeApp.CAMERA_PARAM.fovy, ThreeApp.CAMERA_PARAM.aspect, ThreeApp.CAMERA_PARAM.near, ThreeApp.CAMERA_PARAM.far);
		this.camera.position.copy(ThreeApp.CAMERA_PARAM.position);
		this.camera.lookAt(ThreeApp.CAMERA_PARAM.lookAt);

		// 写真の読み込み
		const img = document.querySelector(".photo img");
		const textureLoader = new THREE.TextureLoader();
		this.texture = textureLoader.load(img.src);

		// カスタムシェーダーを使った板ポリゴンを作成
		const planeGeometry = new THREE.PlaneGeometry(2.0, 2.0, 64, 64);

		const planeMaterial = new THREE.ShaderMaterial({
			uniforms: {
				uTexture: { value: this.texture },
				uMouse: { value: this.mouse },
				uStrength: { value: 0.5 },
			},
			vertexShader: `
				uniform vec2 uMouse;
				uniform float uStrength;
				varying vec2 vUv;

				void main() {
					vUv = uv;
					vec3 pos = position;

					float dist = distance(uv, uMouse);
					float effect = smoothstep(0.3, 0.0, dist);

					pos.z += effect * uStrength;

					gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
				}
			`,
			fragmentShader: `
				uniform sampler2D uTexture;
				varying vec2 vUv;

				void main() {
					gl_FragColor = texture2D(uTexture, vUv);
				}
			`,
		});

		this.plane = new THREE.Mesh(planeGeometry, planeMaterial);
		this.scene.add(this.plane);

		// 元の写真を非表示にする
		const photoDiv = document.querySelector(".photo");
		if (photoDiv) {
			photoDiv.style.display = "none";
		}
	}

	/**
	 * 描画処理
	 */
	render() {
		// 恒常ループ
		requestAnimationFrame(this.render);

		// マウスが外れている場合は中心に戻す
		if (!this.isMouseOver) {
			this.targetMouse.x = 0.5;
			this.targetMouse.y = 0.5;
		}

		// マウス位置を滑らかに補間
		this.mouse.x += (this.targetMouse.x - this.mouse.x) * 0.1;
		this.mouse.y += (this.targetMouse.y - this.mouse.y) * 0.1;

		// レンダリング
		this.renderer.render(this.scene, this.camera);
	}
}

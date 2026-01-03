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
		position: new THREE.Vector3(0.0, 0.0, 5.0),
		lookAt: new THREE.Vector3(0.0, 0.0, 0.0),
	};
	/**
	 * レンダラー定義のための定数
	 */
	static RENDERER_PARAM = {
		clearColor: 0x222222,
		width: window.innerWidth,
		height: window.innerHeight,
	};

	wrapper; // canvas の親要素
	renderer; // レンダラ
	scene; // シーン
	camera; // カメラ
	planes; // 板ポリゴンの配列
	mouse; // マウス位置（正規化座標）
	targetMouse; // マウスの目標位置
	texture; // 写真のテクスチャ
	raycaster; // レイキャスター
	mouseVector; // マウスの3D座標
	draggedObject; // ドラッグ中のオブジェクト
	dragOffset; // ドラッグ時のオフセット

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
		this.mouseVector = new THREE.Vector2();
		this.planes = [];

		// レイキャスターの初期化
		this.raycaster = new THREE.Raycaster();
		this.draggedObject = null;
		this.dragOffset = new THREE.Vector3();

		// this のバインド
		this.render = this.render.bind(this);
		this.onMouseDown = this.onMouseDown.bind(this);
		this.onMouseMove = this.onMouseMove.bind(this);
		this.onMouseUp = this.onMouseUp.bind(this);

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
		this.renderer.domElement.addEventListener("mousedown", this.onMouseDown);
		this.renderer.domElement.addEventListener("mousemove", this.onMouseMove);
		this.renderer.domElement.addEventListener("mouseup", this.onMouseUp);

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

		// 3つの板ポリゴンを作成
		const positions = [-2.5, 0, 2.5]; // x座標

		for (let i = 0; i < 3; i++) {
			const planeGeometry = new THREE.PlaneGeometry(1.5, 1.5, 64, 64);

			const planeMaterial = new THREE.ShaderMaterial({
				uniforms: {
					uTexture: { value: this.texture },
					uMouse: { value: new THREE.Vector2(0.5, 0.5) },
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

			const plane = new THREE.Mesh(planeGeometry, planeMaterial);
			plane.position.x = positions[i];
			plane.userData.originalX = positions[i];
			plane.userData.mouseLocal = new THREE.Vector2(0.5, 0.5);
			plane.userData.targetMouseLocal = new THREE.Vector2(0.5, 0.5);

			this.scene.add(plane);
			this.planes.push(plane);
		}

		// 元の写真を非表示にする
		const photoDiv = document.querySelector(".photo");
		if (photoDiv) {
			photoDiv.style.display = "none";
		}
	}

	/**
	 * マウスダウンイベント
	 */
	onMouseDown(event) {
		// マウス座標を正規化座標に変換
		const rect = this.renderer.domElement.getBoundingClientRect();
		this.mouseVector.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		this.mouseVector.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		// レイキャスト
		this.raycaster.setFromCamera(this.mouseVector, this.camera);
		const intersects = this.raycaster.intersectObjects(this.planes);

		if (intersects.length > 0) {
			this.draggedObject = intersects[0].object;

			// ドラッグ開始位置を記録
			const intersectPoint = intersects[0].point;
			this.dragOffset.copy(intersectPoint).sub(this.draggedObject.position);

			this.renderer.domElement.style.cursor = "grabbing";
		}
	}

	/**
	 * マウス移動イベント
	 */
	onMouseMove(event) {
		const rect = this.renderer.domElement.getBoundingClientRect();
		this.mouseVector.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
		this.mouseVector.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

		// ドラッグ中の処理
		if (this.draggedObject) {
			// レイキャストでz=0平面との交点を計算
			this.raycaster.setFromCamera(this.mouseVector, this.camera);
			const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
			const intersectPoint = new THREE.Vector3();
			this.raycaster.ray.intersectPlane(plane, intersectPoint);

			if (intersectPoint) {
				// x座標のみ移動（-3.5 〜 3.5の範囲に制限）
				const newX = intersectPoint.x - this.dragOffset.x;
				this.draggedObject.position.x = Math.max(-3.5, Math.min(3.5, newX));
			}
		} else {
			// ホバー時のカーソル変更
			this.raycaster.setFromCamera(this.mouseVector, this.camera);
			const intersects = this.raycaster.intersectObjects(this.planes);

			if (intersects.length > 0) {
				this.renderer.domElement.style.cursor = "grab";

				// ホバー中のオブジェクトのローカルマウス座標を更新
				const hoveredPlane = intersects[0].object;
				const uv = intersects[0].uv;
				if (uv) {
					hoveredPlane.userData.targetMouseLocal.set(uv.x, uv.y);
				}
			} else {
				this.renderer.domElement.style.cursor = "default";
			}
		}
	}

	/**
	 * マウスアップイベント
	 */
	onMouseUp() {
		this.draggedObject = null;
		this.renderer.domElement.style.cursor = "default";
	}

	/**
	 * 描画処理
	 */
	render() {
		// 恒常ループ
		requestAnimationFrame(this.render);

		// 各板ポリゴンのローカルマウス座標を滑らかに補間
		this.planes.forEach((plane) => {
			plane.userData.mouseLocal.x += (plane.userData.targetMouseLocal.x - plane.userData.mouseLocal.x) * 0.1;
			plane.userData.mouseLocal.y += (plane.userData.targetMouseLocal.y - plane.userData.mouseLocal.y) * 0.1;

			// シェーダーのuniformを更新
			plane.material.uniforms.uMouse.value.copy(plane.userData.mouseLocal);
		});

		// レンダリング
		this.renderer.render(this.scene, this.camera);
	}
}

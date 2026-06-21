import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

export class ModelCache {
    #loader = new GLTFLoader();
    #cache  = new Map();   // path → { scene, animations, skinned }

    async load(path) {
        if (this.#cache.has(path)) return this.#cache.get(path);

        const gltf = await new Promise((res, rej) =>
            this.#loader.load(path, res, undefined, rej)
        );

        gltf.scene.traverse(c => {
            if (c.isMesh) {
                c.castShadow    = true;
                c.receiveShadow = true;
            }
        });

        const skinned = (gltf.animations?.length ?? 0) > 0;
        this.#cache.set(path, {
            scene:      gltf.scene,
            animations: gltf.animations ?? [],
            skinned,
        });
        return this.#cache.get(path);
    }

    clone(path) {
        const cached = this.#cache.get(path);
        if (!cached) throw new Error(`Not cached: ${path}`);
        return cached.skinned
            ? SkeletonUtils.clone(cached.scene)
            : cached.scene.clone();
    }

    getAnimations(path) {
        return this.#cache.get(path)?.animations ?? [];
    }
}

// Normalize to targetHeight units tall, feet at y=0.
// Uses mesh-only bounding box to avoid skeleton-armature float bug.
export function normalizeModel(model, targetHeight) {
    model.position.set(0, 0, 0);
    model.rotation.set(0, 0, 0);
    model.scale.set(1, 1, 1);
    model.updateMatrixWorld(true);

    const box = new THREE.Box3();
    model.traverse(c => {
        if (c.isMesh && c.geometry) {
            c.geometry.computeBoundingBox();
            const mb = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
            box.union(mb);
        }
    });
    if (box.isEmpty()) box.setFromObject(model);

    const size = box.getSize(new THREE.Vector3());
    if (size.y === 0) return;
    model.scale.setScalar(targetHeight / size.y);
    model.updateMatrixWorld(true);

    // Re-compute after scale to get accurate floor position
    const scaled = new THREE.Box3();
    model.traverse(c => {
        if (c.isMesh && c.geometry) {
            const mb = c.geometry.boundingBox.clone().applyMatrix4(c.matrixWorld);
            scaled.union(mb);
        }
    });
    if (!scaled.isEmpty()) model.position.y = -scaled.min.y;
}

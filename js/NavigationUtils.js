/*
 Copyright 2023 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 *
 * NavigationUtils
 *  - Navigation Utils
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  2/15/2024 - 0.0.1 -
 * Modified:
 *
 */

class NavigationUtils extends HTMLElement {

  static version = '0.0.1';

  /**
   * @type {HTMLElement}
   */
  container;

  /**
   * @type {MapView}
   */
  view;

  /**
   * @type {boolean}
   */
  #loaded = false;
  get loaded() {
    return this.#loaded;
  }

  set loaded(value) {
    this.#loaded = value;
    this.dispatchEvent(new CustomEvent('loaded', {detail: {}}));
  }

  /**
   *
   * @param {HTMLElement|string} [container]
   * @param {MapView} view
   */
  constructor({container, view}) {
    super();

    this.container = (container instanceof HTMLElement) ? container : document.getElementById(container);
    this.view = view;

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {}
      </style>      
      <calcite-progress type="determinate" value="1.0" hidden></calcite-progress> 
    `;

    this.container?.append(this);

  }

  /**
   *
   */
  connectedCallback() {

    // PROGRESS //
    this.progress = this.shadowRoot.querySelector('calcite-progress');

    // GEOMETRY UTILS //
    this.initializeGeometryUtils();

    // LOADED //
    requestAnimationFrame(() => { this.loaded = true; });
  }

  /**
   *
   * @param {Graphic} feature
   * @param {AbortSignal} signal
   * @return {Promise<>}
   */
  navigateToFeature({feature, signal}) {
    return new Promise((resolve, reject) => {
      require([
        'esri/core/reactiveUtils',
        'esri/geometry/geometryEngine'
      ], (reactiveUtils, geometryEngine) => {

        const pickClosestTarget = true;

        reactiveUtils.once(() => !this.view.updating).then(() => {

          //
          // TODO: CREATE DIFFERENT TYPES OF ANIMATIONS BASED ON DISTANCE TRAVELED AND TARGET EXTENT
          //

          const featureExtent = feature.geometry.extent.clone();
          const featureCenter = featureExtent.center.normalize();
          const zoomExtent = featureExtent.expand(1.3);
          // const zoomExtentArea = Math.abs(geometryEngine.geodesicArea(zoomExtent, 'square-kilometers'));

          const viewCenter = this.view.extent.center.normalize();
          // const viewExtentArea = Math.abs(geometryEngine.geodesicArea(this.view.extent, 'square-kilometers'));

          const {midPoint, distance} = this.getMidPoint({pntFrom: viewCenter, pntTo: featureCenter});
          if (distance) {

            const zoomGoTos = [
              {
                target: {target: midPoint, zoom: 4},
                options: {signal, pickClosestTarget, duration: 3500, easing: 'ease-out'}
              },
              {
                target: {target: featureCenter, zoom: 4},
                options: {signal, pickClosestTarget, duration: 3000, easing: 'linear'}
              },
              {
                target: {target: zoomExtent},
                options: {signal, pickClosestTarget, duration: 3500, easing: 'ease-in'}
              }
            ];

            // GO TO NEXT ZOOM TO SETTINGS //
            const _navigateToAnim = () => {
              const zoomGoTo = zoomGoTos.shift();
              if (zoomGoTo && !signal.aborted) {

                this.view.goTo(zoomGoTo.target, zoomGoTo.options).then(() => {
                  requestAnimationFrame(() => { _navigateToAnim(); });
                });

              } else { resolve(); }
            };

            // START NAVIGATE TO ANIMATION //
            requestAnimationFrame(() => { _navigateToAnim(); });

          } else { resolve(); }

        });
      });
    });

  }

  /**
   *
   * @param {boolean} isPlaying
   * @param {number} along
   */
  updateProgress({isPlaying, along}) {
    this.progress.toggleAttribute('hidden', !isPlaying);
    this.progress.setAttribute('value', along);
  }

  /**
   *
   */
  initializeGeometryUtils() {
    require([
      'esri/core/reactiveUtils',
      'esri/geometry/geometryEngine',
      'esri/geometry/Polyline'
    ], (reactiveUtils, geometryEngine, Polyline) => {

      /**
       *
       * @param {Point} pntFrom
       * @param {Point} pntTo
       * @return {{midPoint: Point|null,distance: number|null}}
       */
      this.getMidPoint = ({pntFrom, pntTo}) => {

        const {x: x1, y: y1, spatialReference} = pntFrom;
        const {x: x2, y: y2} = pntTo;

        const polyline = new Polyline({spatialReference, paths: [[[x1, y1], [x2, y2]]]});
        const distance = geometryEngine.geodesicLength(polyline, 'meters');
        if (!distance) {
          return {midPoint: null, distance: null};
        } else {

          const densified = geometryEngine.densify(polyline.clone(), distance * 0.5, 'meters');

          // const points = densified.clone().removePath(0);
          // this.view.graphics = points.map(point => {return {geometry: point};});
          // console.info(points.length);

          return {midPoint: densified.getPoint(0, 1), distance: distance};
        }
      };

      /*this.getMidPoints = ({pntFrom, pntTo}) => {
       const {x: x1, y: y1, spatialReference} = pntFrom;
       const {x: x2, y: y2} = pntTo;
       const polyline = new Polyline({spatialReference, paths: [[[x1, y1], [x2, y2]]]});
       const segmentLength = geometryEngine.geodesicLength(polyline, 'meters');
       if (segmentLength > 10.0) {
       const densified = geometryEngine.densify(polyline, segmentLength * 0.333, 'meters');

       // const points = densified.clone().removePath(0);
       // this.view.graphics = points.map(point => {return {geometry: point};});
       //console.info(points.length)

       return {
       midPoint1: densified.getPoint(0, 1),
       midPoint2: densified.getPoint(0, 3),
       distance: segmentLength
       };
       } else {
       return {
       midPoint1: pntFrom,
       midPoint2: pntTo,
       distance: segmentLength
       };
       }
       };*/

    });
  }

}

customElements.define("apl-navigation-utils", NavigationUtils);

export default NavigationUtils;


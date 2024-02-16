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
 * SubmissionRotatorPanel
 *  - Element: apl-submission-rotator-panel
 *  - Description: Submission Rotator Panel
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  2/14/2024 - 0.0.1 -
 * Modified:
 *
 */

class SubmissionRotatorPanel extends HTMLElement {

  static version = '0.0.1';

  static ITEM_PLAY_DURATION_MS = 30000;

  /**
   * @type {HTMLElement}
   */
  container;

  /**
   * @type {MapView}
   */
  view;

  /**
   * @type {Graphic[]}
   */
  features;

  /**
   * @type {Graphic}
   */
  feature;

  /**
   * @type {number}
   */
  featureIdx = 0;

  /**
   * @type {boolean}
   */
  #loaded = false;

  /**
   *
   * @return {boolean}
   */
  get loaded() {
    return this.#loaded;
  }

  /**
   *
   * @param {boolean} value
   */
  set loaded(value) {
    this.#loaded = value;
    this.dispatchEvent(new CustomEvent('loaded', {detail: {}}));
  }

  /**
   * CREATE WEB COMPONENT
   *
   * @param {HTMLElement|string} [container]
   * @param {MapView} view
   * @param {string} category
   * @param {Graphic[]} features
   */
  constructor({container, view, category, features}) {
    super();

    this.container = (container instanceof HTMLElement) ? container : document.getElementById(container);
    this.view = view;
    this.features = features;

    const shadowRoot = this.attachShadow({mode: 'open'});
    shadowRoot.innerHTML = `
      <style>
        :host {}      
        :host calcite-action-bar {
          justify-content: center;
        }
        :host calcite-card {
          margin: 8px;          
        }                        
      </style>
      <calcite-panel>
        <calcite-action-bar slot="action-bar" expand-disabled>
          <calcite-action class="previous-action" icon="reverse"></calcite-action>
          <calcite-action class="play-action" scale="l" icon="play-f"></calcite-action>
          <calcite-action class="next-action" icon="forward"></calcite-action>          
        </calcite-action-bar>                       
        <calcite-progress class="item-step" type="determinate" value="0.0" text="0 of 0"></calcite-progress>
        <calcite-card class="submission-card" thumbnail-position="block-end">
          <img slot="thumbnail" alt="" src="">
          <div slot="title"></div>
          <div slot="subtitle"></div>
          <div class="description"></div>
          <div slot="footer-start">
            <div>Submitted By: <span class="submitted-by"></span></div>
          </div>
        </calcite-card>
      </calcite-panel>              
    `;

    this.container?.append(this);
  }

  /**
   * WEB COMPONENT CONNECTED
   */
  connectedCallback() {

    this.previousAction = this.shadowRoot.querySelector('.previous-action');
    this.playAction = this.shadowRoot.querySelector('.play-action');
    this.nextAction = this.shadowRoot.querySelector('.next-action');
    this.progressStep = this.shadowRoot.querySelector('calcite-progress.item-step');

    this.card = this.shadowRoot.querySelector('calcite-card');
    this.cardThumbnail = this.card.querySelector('[slot="thumbnail"]');
    this.cardTitle = this.card.querySelector('[slot="title"]');
    this.cardSubtitle = this.card.querySelector('[slot="subtitle"]');
    this.cardDescription = this.card.querySelector('.description');
    this.cardSubmittedBy = this.card.querySelector('.submitted-by');

    // ITEMS ITERATION //
    this.initializeItemsIteration();

    // LOADED //
    requestAnimationFrame(() => { this.loaded = true; });
  }

  /**
   * ITEMS ITERATION = PREV, PLAY, NEXT
   */
  initializeItemsIteration() {

    // FEATURE COUNT //
    const {length: featuresCount} = this.features;

    // DISPLAY CURRENT SUBMISSION //
    const _displayCurrentSubmission = () => {

      // UPDATE PROGRESS //
      this.progressStep.setAttribute('value', ((this.featureIdx + 1) / featuresCount));
      this.progressStep.setAttribute('text', `${ this.featureIdx + 1 } of ${ featuresCount }`);

      // GET CURRENT FEATURE //
      const feature = this.features.at(this.featureIdx);

      // UPDATE SUBMISSION CARD //
      this.updateSubmissionCard({feature});

      // INFORM OTHER PARTS OF THE APP THAT THE SUBMISSION HAS CHANGED //
      this.dispatchEvent(new CustomEvent('submission-change', {detail: {feature}}));
    };

    // PREVIOUS ACTION //
    this.previousAction.addEventListener('click', () => {
      this.featureIdx = (--this.featureIdx < 0) ? (featuresCount - 1) : this.featureIdx;
      _displayCurrentSubmission();
    });

    // NEXT ACTION //
    this.nextAction.addEventListener('click', () => {
      this.featureIdx = (++this.featureIdx > (featuresCount - 1)) ? 0 : this.featureIdx;
      _displayCurrentSubmission();
    });

    // HANDLES //
    let intervalHandle;
    let timeoutHandle;

    // PLAY //
    let isPlaying = false;
    const _playNextStep = () => {

      // CLEAR HANDLES //
      clearTimeout(timeoutHandle);
      clearInterval(intervalHandle);

      // INCREASE FEATURE INDEX //
      this.featureIdx = (++this.featureIdx > (featuresCount - 1)) ? 0 : this.featureIdx;
      // DISPLAY SUBMISSION //
      requestAnimationFrame(() => { _displayCurrentSubmission(); });

      if (isPlaying) {

        // START PROGRESS INTERVAL //
        let start = Date.now();
        intervalHandle = setInterval(() => {
          const duration = (Date.now() - start);
          const along = ((SubmissionRotatorPanel.ITEM_PLAY_DURATION_MS - duration) / SubmissionRotatorPanel.ITEM_PLAY_DURATION_MS);
          this.dispatchEvent(new CustomEvent('play-change', {detail: {isPlaying, along}}));
        }, 100);

        // DURATION WAIT //
        timeoutHandle = setTimeout(() => {
          clearInterval(intervalHandle);
          isPlaying && requestAnimationFrame(() => { _playNextStep(); });
        }, SubmissionRotatorPanel.ITEM_PLAY_DURATION_MS);
      }
    };

    // ENABLE PLAY //
    const enablePlay = enabled => {

      clearTimeout(timeoutHandle);
      clearInterval(intervalHandle);
      isPlaying = this.playAction.toggleAttribute('active', enabled);
      this.playAction.setAttribute('icon', isPlaying ? 'pause-f' : 'play-f');
      this.dispatchEvent(new CustomEvent('play-change', {detail: {isPlaying}}));

      isPlaying && _playNextStep();
    };

    // STOP PLAY //
    this.stopPlay = () => {
      enablePlay(false);
    };

    // PLAY ACTION //
    this.playAction.addEventListener('click', () => {
      enablePlay(!this.playAction.hasAttribute('active'));
    });

    // DISPLAY INITIAL SUBMISSION //
    _displayCurrentSubmission();

  }

  /**
   * UPDATE SUBMISSION CARD
   *
   * @param {Graphic} feature
   */
  updateSubmissionCard({feature}) {

    const {SubmissionTitle, SubmissionDescription, SubmissionAuthor, SubmissionThumbnail, SubmissionIndustries} = feature.attributes;

    this.cardThumbnail.src = SubmissionThumbnail;
    this.cardTitle.innerHTML = SubmissionTitle;
    this.cardSubtitle.innerHTML = `${ SubmissionIndustries }`;
    this.cardDescription.innerHTML = SubmissionDescription;
    this.cardSubmittedBy.innerHTML = SubmissionAuthor;

  }

  /**
   * LOAD
   *
   * @returns {Promise<>}
   */
  load() {
    return new Promise((resolve, reject) => {
      if (this.loaded) { resolve(); } else {
        this.addEventListener('loaded', () => { resolve(); }, {once: true});
      }
    });
  }

}

customElements.define("apl-submission-rotator-panel", SubmissionRotatorPanel);

export default SubmissionRotatorPanel;

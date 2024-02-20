/*
 Copyright 2022 Esri

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

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";
import ViewLoading from './apl/ViewLoading.js';
import MapScale from './apl/MapScale.js';
import SubmissionRotatorPanel from './SubmissionRotatorPanel.js';
import NavigationUtils from './NavigationUtils.js';

/**
 *
 *   https://mapgallery.esri.com/map-of-maps
 *
 */

class Application extends AppBase {

  // PORTAL //
  portal;

  // EVENT NAME FIELD NAME //
  eventNameFieldName = 'SubmissionEventName';

  // REQUIRED FIELD NAMES //
  requiredFieldNames = ['SubmissionThumbnail', 'SubmissionFirstCategory', 'SubmissionFirstIndustry'];

  // GROUPING/FILTER FIELD NAME //
  groupingFieldName = 'SubmissionFirstCategory'; // SubmissionFirstIndustry | SubmissionFirstCategory;

  /**
   *
   */
  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // SET APPLICATION DETAILS //
        this.setApplicationDetails({map, group});

        // STARTUP DIALOG //
        this.initializeStartupDialog();

        // VIEW SHAREABLE URL PARAMETERS //
        this.initializeViewShareable({view});

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {

          // HIDE APP LOADER //
          document.getElementById('app-loader').toggleAttribute('hidden', true);
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   * @param view
   */
  configView({view}) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/core/reactiveUtils',
          'esri/widgets/Popup',
          'esri/widgets/Home',
          'esri/widgets/Search',
          'esri/widgets/Compass'
        ], (reactiveUtils, Popup, Home, Search, Compass) => {

          // VIEW AND POPUP //
          view.set({
            constraints: {snapToZoom: false},
            scale: 120000000,
            environment: {
              atmosphereEnabled: false
            },
            popup: new Popup({
              dockEnabled: true,
              dockOptions: {
                buttonEnabled: false,
                breakpoint: false,
                position: "top-right"
              }
            })
          });

          // SEARCH //
          // const search = new Search({view: view});
          // view.ui.add(search, {position: 'top-left', index: 0});

          // HOME //
          const home = new Home({view});
          view.ui.add(home, {position: 'top-left', index: 0});

          // COMPASS //
          const compass = new Compass({view: view});
          view.ui.add(compass, {position: 'top-left'});
          reactiveUtils.watch(() => view.rotation, rotation => {
            compass.set({visible: (rotation > 0)});
          }, {initial: true});

          // MAP SCALE //
          const mapScale = new MapScale({view});
          view.ui.add(mapScale, {position: 'bottom-left', index: 0});

          // VIEW LOADING INDICATOR //
          this.viewLoading = new ViewLoading({view: view});
          view.ui.add(this.viewLoading, 'bottom-right');

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView({view}).then(() => {

        // NAVIGATION UTILS //
        this.navigationUtils = new NavigationUtils({container: 'navigation-utils-container', view});

        // MEDIA LAYER //
        this.initializeMediaLayer({view});

        // MAP GALLERY SUBMISSIONS LAYER //
        this.initializeMapGalleryLayer({view});

        resolve();
      }).catch(reject);
    });
  }

  /**
   *
   * GET EVENT FILTER
   *
   * @param {boolean} currentOnly
   * @return {string}
   */
  getEventFilter({currentOnly = true}) {

    // REQUIRED FIELDS //
    const requiredFilterParts = this.requiredFieldNames.map(requiredFieldName => {
      return `(${ requiredFieldName } IS NOT NULL)`;
    });

    // ALL EVENTS OR CURRENT EVENT ONLY //
    currentOnly && requiredFilterParts.push(`(SubmissionEventName = '${ this.eventName }')`);

    // EVENTS FILTER //
    return requiredFilterParts.join(' AND ');
  };

  /**
   *
   * https://www.arcgis.com/home/item.html?id=27dd4f98576f4c0a843c2613aa5392de
   *
   * https://services1.arcgis.com/G84Qg78md8fRCEAD/arcgis/rest/services/Map_Gallery_Map_of_Maps_(Prd)_View/FeatureServer/0
   *
   * @param view
   */
  initializeMapGalleryLayer({view}) {
    require(['esri/core/reactiveUtils'], (reactiveUtils) => {

      const filterLayer = view.map.allLayers.find(layer => layer.title === "Map Gallery Submissions Filter");
      filterLayer.load().then(() => {
        filterLayer.set({
          outFields: ["*"]
        });

        const submissionsLayer = view.map.layers.find(layer => layer.title === "Map Gallery Submissions");
        submissionsLayer.load().then(() => {
          submissionsLayer.set({
            outFields: ["*"],
            labelsVisible: true,
            labelingInfo: [{
              labelExpressionInfo: {
                expression: `
                  var title = $feature.SubmissionTitle;
                  var titleCount = Count(title);
                  if(titleCount < 40) {
                    return title;
                  } else {
                    var midLength = Floor(titleCount / 2);
                    var parts = Split(title,' ');
                    var partIdx = 0;
                    var splitIdx = 0;
                    while(splitIdx < midLength) {
                      splitIdx += (Count(parts[partIdx++]) + 1);
                    }
                    var leftLabel = Left(title, splitIdx);
                    var rightLabel = Right(title, (titleCount - splitIdx));
                    return Concatenate([leftLabel, rightLabel], TextFormatting.NewLine);
                   }`
              },
              maxScale: 0,
              minScale: 50000000,
              symbol: {
                type: 'text',
                color: '#efefef',
                font: {size: 9},
                backgroundColor: 'rgba(53,53,53,0.7)',
                borderLineColor: '#2b2b2b',
                borderLineSize: 1.2
              }
            }]
          });

          // APPLY FEATURE EFFECT TO FILTER //
          this.applyFeatureEffect = ({featureEffect}) => {
            filterLayer.set({featureEffect});
            submissionsLayer.set({featureEffect});
          };

          // CATEGORY FILTER //
          const filterTypeOption = document.getElementById('filter-type-option');
          filterTypeOption.addEventListener('calciteSegmentedControlChange', () => {
            // UPDATE CATEGORY FILTER FIELD //
            this.groupingFieldName = filterTypeOption.value;
            // DISPLAY LIST OF CATEGORIES //
            this.displaySubmissionsFilterList();
          });

          // UPDATE CURRENT EVENT FILTER //
          this.setCurrentEventFilter = () => {
            const definitionExpression = this.getEventFilter({currentOnly: true});
            filterLayer.set({definitionExpression});
            submissionsLayer.set({definitionExpression});
          };

          // SET EVENTS LIST //
          // this.initializeEventsList({view, submissionsLayer}).then(() => {
          // SET INITIAL EVENT NAME LABEL //
          this.snippet = this.eventName;
          // SET INITIAL EVENT FILTER //
          this.setCurrentEventFilter();
          // GROUPING PICKER //
          this.initializeCategoryPicker({view, submissionsLayer});
          // });
        });
      });
    });
  }

  /**
   *
   * @param view
   * @param submissionsLayer
   */

  /*
   initializeEventsList({view, submissionsLayer}) {
   return new Promise((resolve, reject) => {
   require([
   'esri/core/reactiveUtils',
   'esri/smartMapping/statistics/uniqueValues'
   ], (reactiveUtils, uniqueValues) => {

   // SET INITIAL EVENT NAME LABEL //
   this.snippet = this.eventName;

   // GET LIST OF ALL EVENTS //
   uniqueValues({
   layer: submissionsLayer,
   sqlWhere: this.getEventFilter({currentOnly: false}),
   field: this.eventNameFieldName
   }).then(({uniqueValueInfos}) => {

   const eventNames = uniqueValueInfos.reduce((list, {value, count}) => {
   // ONLY INTERESTED IN UC SUBMISSIONS FOR THIS APP //
   if (value?.includes('User Conference')) {
   list.push(value.trim());
   }
   return list;
   }, []);
   eventNames.sort().reverse();

   const onEventChange = (eventName) => {

   // UPDATE EVENT LABEL //
   this.snippet = eventName;

   // SET PARAMETER AS SHAREABLE //
   this.setParameter('eventName', eventName, true);
   //  OPTION TO SHOW URL SHARE PARAMS //
   //window.history.pushState('', '', this.toShareURL());

   // SET INITIAL EVENT FILTER //
   this.setCurrentEventFilter();
   // DISPLAY LIST OF CATEGORIES //
   this.displaySubmissionsFilterList();
   };

   // EVENT OPTIONS //
   const eventOptions = eventNames.map(eventName => {
   const eventOption = document.createElement('calcite-option');
   eventOption.innerHTML = eventName;
   eventOption.setAttribute('value', eventName);
   eventOption.toggleAttribute('selected', eventName === this.eventName);
   return eventOption;
   });

   // EVENT SELECT //
   const eventSelect = document.getElementById('event-select');
   eventSelect.replaceChildren(...eventOptions);
   eventSelect.addEventListener('calciteSelectChange', () => {
   onEventChange(eventSelect.value);
   });

   resolve();
   });

   });
   });
   }
   */

  /**
   *
   * @param view
   * @param submissionsLayer
   */
  initializeCategoryPicker({view, submissionsLayer}) {
    require([
      'esri/core/reactiveUtils',
      'esri/smartMapping/statistics/uniqueValues'
    ], (reactiveUtils, uniqueValues) => {

      //const submissionsCountChip = document.getElementById('submissions-count-chip');
      const submissionCategoryList = document.getElementById('submission-category-list');

      // CATEGORY SELECTED //
      const _categorySelected = category => {
        this.setParameter(this.groupingFieldName, category, true);
        this.setParameter('category', category, true);

        const featureEffect = {
          filter: {where: `(${ this.groupingFieldName } = '${ category }')`},
          includedEffect: 'opacity(1.0)',
          excludedEffect: 'opacity(0.1)'
        };
        this.applyFeatureEffect({featureEffect});
      };

      /**
       *
       */
      this.displaySubmissionsFilterList = () => {

        uniqueValues({
          layer: submissionsLayer,
          sqlWhere: submissionsLayer.definitionExpression,
          field: this.groupingFieldName
        }).then(({uniqueValueInfos}) => {

          // CREATE LIST ITEMS OF CATEGORIES //
          let featureCount = 0;
          const listItems = uniqueValueInfos.reduce((list, {value, count}) => {
            if (value) {

              featureCount += count;

              /*
               const countChip = document.createElement('calcite-chip');
               countChip.setAttribute('slot', 'actions-start');
               countChip.setAttribute('scale', 's');
               countChip.innerHTML = String(count).padStart(2, '0');
               */

              const rotateAction = document.createElement('calcite-action');
              rotateAction.setAttribute('slot', 'actions-end');
              rotateAction.setAttribute('icon', 'slideshow');
              rotateAction.setAttribute('title', 'Slideshow...');
              rotateAction.addEventListener('click', () => {
                this.displayRotatorPanel({view, submissionsLayer, category: value});
              });

              const listItem = document.createElement('calcite-list-item');
              listItem.setAttribute('value', value);
              listItem.setAttribute('label', value);
              listItem.setAttribute('title', `${ count } submissions`);
              listItem.toggleAttribute('selected', !list.length);
              //listItem.append(countChip, rotateAction);
              listItem.append(rotateAction);

              list.push(listItem);
            }

            return list;
          }, []);

          // TOTAL FEATURE COUNT FOR EVENT //
          //submissionsCountChip.innerHTML = featureCount;
          // DISPLAY LIST OF CATEGORIES //
          submissionCategoryList.replaceChildren(...listItems);

          // SET INITIAL CATEGORY //
          _categorySelected(listItems.at(0).value);

        });
      };

      // CATEGORY CHANGE //
      submissionCategoryList.addEventListener('calciteListChange', () => {
        const [selectedItem] = submissionCategoryList.selectedItems;
        _categorySelected(selectedItem.value);
      });

      // BACK TO CATEGORY LIST //
      const initialViewpoint = view.viewpoint.clone();
      this.addEventListener('rotator-back', () => {

        // RESET CURRENT CATEGORY //
        const [selectedItem] = submissionCategoryList.selectedItems;
        _categorySelected(selectedItem.value);

        // GO TO INITIAL VIEWPOINT //
        view.goTo({target: initialViewpoint});
      });

      // DISPLAY INITIAL FILTER LIST //
      this.displaySubmissionsFilterList();

    });
  }

  /**
   *
   * @param {Graphic} feature
   * @param {AbortSignal} signal
   */
  onSubmissionChange({feature, signal}) {

    //this.addImageElement({feature});

    const featureEffect = {
      filter: {objectIds: [feature.getObjectId()]},
      includedEffect: 'opacity(0.4)',
      excludedEffect: 'opacity(0.1)'
    };
    this.applyFeatureEffect({featureEffect});

    this.viewLoading.enabled = false;
    this.navigationUtils.navigateToFeature({feature, signal}).then(() => {
      this.viewLoading.enabled = true;

      const featureEffect = {
        filter: {objectIds: [feature.getObjectId()]},
        includedEffect: 'opacity(1.0) saturate(1.5)',
        excludedEffect: 'opacity(0.1)'
      };
      this.applyFeatureEffect({featureEffect});
    });

  }

  /**
   *
   * @param view
   * @param submissionsLayer
   * @param category
   */
  displayRotatorPanel({view, submissionsLayer, category}) {

    //const eventSelectContainer = document.getElementById('event-select-container');
    //eventSelectContainer.toggleAttribute('disabled', true);

    let rotatorPanel;
    let abortController;

    // CREATE FLOW ITEM //
    const flowItem = document.createElement('calcite-flow-item');
    flowItem.setAttribute('heading', category);
    // FLOW ITEM BACK //
    flowItem.addEventListener('calciteFlowItemBack', () => {

      // ENABLE EVENT SELECT //
      //eventSelectContainer.toggleAttribute('disabled', false);
      // ABORT GOTO NAVIGATION //
      abortController?.abort();
      // STOP PLAY //
      rotatorPanel?.stopPlay();

      // ROTATOR BACK //
      this.dispatchEvent(new CustomEvent('rotator-back', {detail: {}}));
    });

    // GET CATEGORY FEATURES //
    const categoryQuery = submissionsLayer.createQuery();
    categoryQuery.set({where: `${ submissionsLayer.definitionExpression } AND (${ this.groupingFieldName } = '${ category }')`});
    submissionsLayer.queryFeatures(categoryQuery).then(({features}) => {

      // CREATE NEW ROTATOR PANEL //
      rotatorPanel = new SubmissionRotatorPanel({view, category, features});
      // SUBMISSION CHANGE //
      rotatorPanel.addEventListener('submission-change', ({detail: {feature}}) => {
        abortController?.abort();
        abortController = new AbortController();
        this.onSubmissionChange({feature, signal: abortController.signal});
      });
      // PLAY CHANGE //
      rotatorPanel.addEventListener('play-change', ({detail: {isPlaying, along}}) => {
        this.navigationUtils.updateProgress({isPlaying, along});
      });

      // ADD ROTATOR PANEL TO FLOW ITEM //
      flowItem.append(rotatorPanel);
      // ADD FLOW ITEM TO FLOW //
      const submissionsFlow = document.getElementById('submissions-flow');
      submissionsFlow.append(flowItem);
    });

  }

  /**
   *
   * @param view
   */
  initializeMediaLayer({view}) {
    require([
      'esri/core/reactiveUtils',
      'esri/layers/MediaLayer',
      'esri/layers/support/ImageElement',
      'esri/layers/support/ExtentAndRotationGeoreference'
    ], (reactiveUtils, MediaLayer, ImageElement, ExtentAndRotationGeoreference) => {

      const submissionsMediaLayer = new MediaLayer({
        title: "Esri User Conference 2023 Map Gallery Submissions",
        source: []
      });
      view.map.add(submissionsMediaLayer);

      this.addImageElement = ({feature}) => {

        const {geometry, attributes: {SubmissionThumbnail}} = feature;

        /*const thumbnailImage = document.createElement('img');  // img HTMLImageElement
         // thumbnailImage.mode = 'no-cores';
         //thumbnailImage.crossorigin = 'anonymous'; // 'use-credentials';
         // thumbnailImage.referrerpolicy = 'origin-when-cross-origin';
         thumbnailImage.onload = () => {

         /!*const canvas = document.createElement('canvas');
         const ctx = canvas.getContext('2d');
         canvas.height = thumbnailImage.naturalHeight;
         canvas.width = thumbnailImage.naturalWidth;
         ctx.drawImage(thumbnailImage, 0, 0);
         const dataUrl = canvas.toDataURL();

         const imageElement = new ImageElement({
         image: dataUrl,
         georeference: new ExtentAndRotationGeoreference({extent: geometry.extent})
         });
         submissionsMediaLayer.source.elements = [imageElement];*!/

         };
         thumbnailImage.onerror = (error) => {
         console.error(error);
         };
         thumbnailImage.src = `https://webnode.esri.com/3014/proxy?bypassReferrer=true&url=${SubmissionThumbnail}`;*/

        /*const proxyUrl = new URL('https://webnode.esri.com/3014/proxy');
         proxyUrl.search = new URLSearchParams({
         bypassReferrer: true,
         url: SubmissionThumbnail
         }).toString();

         fetch(proxyUrl, {
         method: 'GET',
         redirect: 'follow'
         }).then((response) => {
         return response.blob();
         }).then((blob) => {

         const img = new Image();
         img.src = URL.createObjectURL(blob);
         console.info(img);

         });*/

        //const imageURL = `https://webnode.esri.com/3014/proxy?bypassReferrer=true&url=${ SubmissionThumbnail }`;

        const imageElement = new ImageElement({
          image: SubmissionThumbnail,
          georeference: new ExtentAndRotationGeoreference({extent: geometry.extent})
        });
        submissionsMediaLayer.source.elements = [imageElement];

      };

    });
  }

}

export default new Application();

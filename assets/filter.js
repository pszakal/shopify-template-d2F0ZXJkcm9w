(function () {
  
  /**
   * filter.js is a Javascipt helper for section/filter.liquid
   * handles DOM interactions and manipulation, 
   * fetches collection data asynchronously
   */
  
  const filters = {}; // to store Filter classes
  const summaryItems = {}; // to store Summary classes

  const filterNode = document.getElementById('wd-filters');
  const formNode = filterNode.querySelector('form');
  const summaryNode = document.getElementById('wd-filter-summary');
  const drawerNode = document.getElementById('wd-filter-drawer');
  const backdropNode = drawerNode.querySelector('.backdrop');

  
  let collectionParameters, sectionParameters;

  // get parameters from liquid:
  try {
    collectionParameters = JSON.parse(document.getElementById('wd-collection-parameters').innerHTML);
    sectionParameters = JSON.parse(document.getElementById('wd-filter-selction-parameters').innerHTML)
  } catch (error) {
    console.error('Error parsing collection settings:', error);
  }
  
  // enable / disable apply button (mode)
  let enable_apply_button;
  if(sectionParameters && sectionParameters.enable_apply_button){
    enable_apply_button = sectionParameters.enable_apply_button === 'true';
  }

  const updateURL = function (searchParams) {
    history.pushState({ searchParams }, '', `${window.location.pathname}${searchParams && '?'.concat(searchParams)}`);
  }

  const getFilteredCollection = async function (url) {
    const response = await fetch(`?${url}&view=filter-provider`);
    return await response.text();
  }

  const getID = function (name, value) {
    return name + (value ? value : '');
  }

  class Filter {
    constructor(params) {
      this.node = params.node;
      this.node.addEventListener('click', this.onClick);
      const name = this.node.getAttribute('name');

      // Initialize reset button of the current filter:
      const resetButtons = this.node.querySelectorAll( `.filter-button[name="${name}"] .filter-reset-button` );
      if (resetButtons) {
        resetButtons.forEach((resetButton) => {
          resetButton.addEventListener('click', e => {
            this.handleResetClick(e, name);
          });
        })
      }

      // Initialize all input elements of the current filter:
      const formElements = this.node.querySelectorAll( `.filter-button[name="${name}"] input,select` );
      if(formElements.length){
        this.inputs = Array.from(formElements).map( element => this.initializeInputElement(element, name) );        
      }
      
    }

    handleResetClick(event,name) {
      event.preventDefault();
      this.reset();

      // reset all summary items within a filter category (eg. it can be more size items)
      Object.keys(summaryItems).forEach(key => {
        if (key.startsWith(name) && summaryItems[key]) {
          summaryItems[key].reset();
        }
      })
      applyChanges();
    }

    initializeInputElement(element, filterName) {
      const subname = element.getAttribute('name');
      const label = element.getAttribute('label');
      const urlToRemove = element.getAttribute('url_to_remove');
      

      element.addEventListener('change', (event) => {
        this.handleInputChange(event, filterName, subname, label, urlToRemove);
      });

      return element;
    }

    handleInputChange(event, filterName, subname, label, urlToRemove) {
      const value = event.target.getAttribute('value') || event.target.value;
      
      // Connect every input states to the corresponding input element of the opposite device's UI
      const currentInputs = filterNode.querySelectorAll(`input[name="${subname}"][value="${value}"]`);
      if (currentInputs) {
        currentInputs.forEach(input => {
          if (!input.isSameNode(event.target)) {
            const type = input.getAttribute('type');
            if (type === 'checkbox') {
              input.checked = event.target.checked;
            } else if (type === 'number') {
              input.value = event.target.value;
            }
          }
        });
      }
      
      const id = getID(filterName, value);
      const isPriceRange = filterName === 'filter.v.price';

      const selector = isPriceRange ? `[name="filter.v.price"]` : `[name="${subname}"] [value="${value}"]`;
      const summaryItemNode = summaryNode.querySelector(selector);


      if (summaryItemNode) {
        if (isPriceRange) {
          const priceRangeNode = summaryItemNode.querySelector(`span[name="${event.target.name}"]`);
          if (priceRangeNode) {
            priceRangeNode.innerHTML = event.target.value || '';
          }
        } else {
          summaryItems[id].reset();
        }
      } else {
        const summaryItem = new SummaryItem({ node: this.node, name: filterName, value });
        summaryItems[id] = summaryItem;
        summaryItem.add({ name: filterName, subname, label, value, urlToRemove });
      }
      

      applyChanges();
    }

    onClick(e) {
      
      const isClickInsidePopupLaucher = !e.target.closest('.filter-settings') && this.contains(e.target);

      const selectors = ['price-range input','filter-setting input','filter-footer a'];      
      const inputNodes = this.querySelectorAll(selectors.map(selector => '.'+selector+':not(wd-filter-drawer *)').join(','));

      const onKeydown = event => {
        if (event.key === 'Escape') {
          clickOutside({target:null});
        } 
      }

      const clickOutside = event => {

        if(event.target && event.target.getAttribute('type') === 'number'){ 
          event.preventDefault();
        }

        const isClickInsidePopup = e.target.contains(event.target);
        
        if (!isClickInsidePopup) {
          this.classList.remove('active');
          document.removeEventListener('click', clickOutside);
          document.removeEventListener('keydown', onKeydown);
          this.removeKeyboardNavigationListener();
        }
      }

      if (isClickInsidePopupLaucher) {
        e.preventDefault();
        
        this.classList.toggle('active');
        
        const active = this.classList.contains('active');

        if(active){
          this.removeKeyboardNavigationListener = handleKeyboardNavigation(this, inputNodes)
        } else {
          this.removeKeyboardNavigationListener();
        }
          
        if (this.classList.contains('active')) {
          setTimeout(() => {
            document.addEventListener('click', clickOutside)
          }, 0);
        }
      }
    }

    reset(singleValue) {
      // Resets the input state that has the value of singleValue.
      // If singleValue is not provided it resets all input states 
      // in the category.

      this.inputs.forEach((input) => {

        if(singleValue && input.getAttribute('value') !== singleValue){
          return
        }

        const type = input.getAttribute('type');
        if (type === 'checkbox') {
          input.checked = false;
        } else if (type === 'number') {
          input.value = "";
        }
      });
    }
  }

  class SummaryItem {
    constructor(params) {
      this.name = params.name;
      this.value = params.value;
      this.id = getID(this.name, this.value);
      const node = params.node;

      // initialize summary item if existed in liquid:
      if (node) {
        this.init(node);
      }
    }

    closeButtonClick = (event) => {
      event.preventDefault();
      filters[this.name].reset(this.value);
      this.reset();
      applyChanges();
    }

    init(node) {
      // initialize existing summary item

      this.node = node;

      // disable loading '<a>' tag's target link:
      const link = node.querySelector('a');
      if (link) link.addEventListener('click', e => { e.preventDefault(e) });

      const closeButton = node.querySelector('svg');
      if (closeButton) {
        closeButton.addEventListener('click', e => this.closeButtonClick(e));
      }
    }
    
    add(data) {
      // add a new summary item on the client side

      const name = data.name;
      const subname = data.subname;
      let label = data.label;
      const link = document.createElement('a');
      link.href = data.urlToRemove;
      link.setAttribute('name', name);
      link.setAttribute('value', data.value);
      link.addEventListener('click', e => { e.preventDefault(e) });
      const wrapper = document.createElement('span');
      if (name === 'filter.v.price') {
        const filter = filters[name];
        let min = subname.endsWith('gte') ? data.value : filter.inputs[0].getAttribute('min');
        let max = subname.endsWith('lte') ? data.value : filter.inputs[1].getAttribute('max');
        label = `<span name="filter.v.price.gte">${min}</span>-<span name="filter.v.price.lte">${max}</span>`;
      }
      wrapper.innerHTML = label;
      link.appendChild(wrapper);
      const closeButton = document.createElement('span');
      closeButton.innerHTML = `
        <svg aria-hidden="true" focusable="false" role="presentation" width="12" height="13" class="icon icon-close-small" viewBox="0 0 12 13" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M8.48627 9.32917L2.82849 3.67098" stroke="#333030" stroke-linecap="round" stroke-linejoin="round"></path>
          <path d="M2.88539 9.38504L8.42932 3.61524" stroke="#333030" stroke-linecap="round" stroke-linejoin="round"></path>
        </svg>
        <span class="visually-hidden">clear</span>
      `
      closeButton.addEventListener('click', e => this.closeButtonClick(e))
      const item = document.createElement('div');
      item.setAttribute('name', data.name);
      item.classList.add('filter-summary-item','filter-summary-button', 'adding');
      setTimeout(() => {
        item.classList.remove('adding');
      }, 1);
      item.appendChild(link);
      wrapper.appendChild(closeButton);
      wrapper.setAttribute('value', data.value);
      if (Object.keys(summaryItems).length === 0) {
        summaryNode.classList.remove('open');
      } else {
        summaryNode.classList.add('open');
      }
      summaryNode.insertBefore(item, summaryNode.firstChild);
      this.node = item;
    }

    reset() {
      // removes the current summary item
      
      this.node.classList.add('deleting');
      setTimeout(() => {
        this.node.remove();
      }, 200);
      delete summaryItems[this.id]
      if (Object.keys(summaryItems).length === 0) {
        summaryNode.classList.remove('open');
      } else {
        summaryNode.classList.add('open');
      }
    }
  }

  
  
  const forceApplyChanges = function(){
    // if applyButton is enabled, forceApplyChanges() should be called

    applyChanges(true);
  }


  
  
  const applyChanges = function (force) {

    // * updates the url location and 
    // * get filtered collection data
    // * renders the products cards and result stats

    if(!force && enable_apply_button){
      return;
    }

    // update browser url:
    let formData = new FormData(formNode);
    const searchParams = new URLSearchParams(formData);
    updateURL(searchParams.toString());

    // extend form data before fetch request with collection parameters:
    addCollectionParametersToFormData(formData);

    
    // fetch the filtered product list:

    const filteredProductURL = new URLSearchParams(formData).toString();
    filterNode.classList.add('loading');

    getFilteredCollection(filteredProductURL).then(result => {

      // parse result in to DOM structure:
      const html = new DOMParser().parseFromString(result, 'text/html');

      const container = document.getElementById('ProductGridContainer');
      const grid = container.querySelector('.collection');

      // remove previous results:
      grid.innerHTML = '';

      // insert to DOM:
      const cards = html.getElementById('product-grid');
      //grid.insertBefore(cards, grid.firstChild);
      grid.appendChild(cards);
      
      // remove empty alert that may come from main-collection-product-grid.liquid 
      // if the page was loaded with no product results:
      const emptyNode = document.querySelector('.collection--empty .title-wrapper');
      if(emptyNode) emptyNode.remove();

      // update pagination nodes too:
      const pagination = html.getElementById('pagination');
      grid.appendChild(pagination)
      
      updateProductStats(html);

    }).finally(() => {
      filterNode.classList.remove('loading');
    });
  }

  const getFormSearchParams = function () {
    return new URLSearchParams( new FormData(formNode) );
  };


  const updateProductStats = function (html) {
    // Product stats updater. It reads the passed data from the 
    // server (collection.filter-provider.liquid) and updates the DOM.

    const resultStats = html.getElementById('stats');
    try {
      const stats = JSON.parse(resultStats.innerHTML);
      document.querySelectorAll('.wd-filter-products-count').forEach(el => { el.innerHTML = stats.products_count; })
      document.querySelectorAll('.wd-filter-all-products-count').forEach(el => { el.innerHTML = stats.all_products_count; });
    } catch (error) { }
  }

  
  const addCollectionParametersToFormData = function (formData) {
    // adds collection parameters to the form data 
    // (like media_aspect_ratio and products_per_page)

    if (collectionParameters) {
      for (let key in collectionParameters) {
        formData.append(key, collectionParameters[key]);
      }
    }
  }

  const mainClearButton = document.getElementById('wd-filter-clear');
  mainClearButton.addEventListener('click', (e) => {
    e.preventDefault();
    resetFiltersAndSummaries();
    applyChanges();
  })

  if(enable_apply_button){
    const applyButtons = document.querySelectorAll('.wd-apply-button');
    
    applyButtons.forEach((button) => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        drawerNode.classList.remove('open');
        forceApplyChanges();
      })
    })
  }


  const sortNode = filterNode.querySelector('.filter-setting-select')
  if(sortNode){
    sortNode.addEventListener('change', applyChanges )
  }
  

  const resetFiltersAndSummaries = function () {
    Object.values(filters).forEach(
      filter => filter.reset()
    );

    Object.values(summaryItems).forEach(
      summary => summary.reset()
    );
  }

  const initializeFilterDrawerForMobile = function () {
    const openFilterDrawerButton = document.getElementById('open-filter-drawer');
    if (openFilterDrawerButton) {
      openFilterDrawerButton.addEventListener('click', (e) => {
        e.preventDefault();
        drawerNode.classList.add('open');
      })

      const closeButton = drawerNode.querySelector('.close-button');
      if (closeButton) {
        closeButton.addEventListener('click', (e) => {
          e.preventDefault();
          drawerNode.classList.remove('open');
        })
      }
      
      if (backdropNode) {
        backdropNode.addEventListener('click', (e) => {
          drawerNode.classList.remove('open');
        })
      }
    }
  }

  const initializeFilterObjects = function () {
    const filterMenuItems = filterNode.querySelectorAll('.filter-button');
    if (filterMenuItems) {
      Array.from(filterMenuItems).forEach((menu) => {
        const name = menu.getAttribute('name');
        if (name) {
          
          // create filter object:
          const filter = new Filter({ node: menu });

          // add to filters object only once:
          const isDrawer = drawerNode.contains(menu);
          if(!isDrawer) {
            filters[name] = filter;
          }
        }
        initializeExistingSummaryItems(name);
      });
    }
  }

  const initializeExistingSummaryItems = function (filterName) {
    const summaries = summaryNode.querySelectorAll(`div[name="${filterName}"]`);
    summaries.forEach((summary) => {
      if (summary) {
        const valueNode = summary.querySelector('a>span[value]');
        let value;
        if (valueNode) { value = valueNode.getAttribute('value'); }
        
        // create summary object:
        const summaryItem = new SummaryItem({ node: summary, name: filterName, value });

        // add to summaryItems object:
        summaryItems[getID(filterName, value)] = summaryItem;
      }
    });
  }

  const handleKeyboardNavigation = (button, inputNodes) => {

    const onKeydown = event => {
      if (event.key === 'Escape') {
        const openedFilterNodes =  filterNode.querySelectorAll('.active');
        if(openedFilterNodes.length) {
          openedFilterNodes.forEach(node => node.classList.remove('active')); // close all active filters
        }
        inputNodes.forEach(i => i.tabIndex =  -1);
        button.focus();
      } else if (event.key.startsWith('Arrow')) {
        event.preventDefault();

        const node = document.activeElement.closest('.filter-setting,.filter-footer');
        let target;
        if(node){
          if(event.key === 'ArrowDown'){ 
            target = node.nextElementSibling;
            if(!target){
              target = node.parentElement.firstElementChild;
            }
            target.querySelector('input,a').focus();
          } else if(event.key === 'ArrowUp') { 
            target = node.previousElementSibling;
            if(!target){
              target = node.parentElement.lastElementChild;
            }
            target.querySelector('input,a').focus();
          } 
        }
        // todo: add left and right arrow keys support
      }
    }

    
    document.addEventListener('keydown', onKeydown);
    if(inputNodes.length){
      inputNodes[0].focus();
      inputNodes.forEach(i => i.tabIndex =  0);
    }
    

    return () => {
      document.removeEventListener('keydown', onKeydown);
      this.focus();
      inputNodes.forEach(i => i.tabIndex =  -1);
    };
  }

  const fixBackForwardNavigation = function () {

    // single fix for back and forward navigation
    // possible improvements: re-render page based 
    // on existing data

    const onHistoryChange = (event) => {
      const searchParams = getFormSearchParams().toString();
      if (searchParams !== event.state.searchParams) {
        document.location.reload();
      }
    }
    window.addEventListener('popstate', onHistoryChange);
  }

  initializeFilterDrawerForMobile();
  initializeFilterObjects();
  fixBackForwardNavigation();

})();

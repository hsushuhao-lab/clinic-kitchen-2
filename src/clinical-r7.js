/* R8.2 compatibility shim.
   Historical R7 0-100 clinical UI is disabled.
   R8 clinical state is owned by clinic-flow.js and clinic-rules.js.
*/
(function(){
  'use strict';

  window.CKR7LegacyUI = Object.freeze({
    enabled: false,
    reason: 'superseded-by-r8.2'
  });
})();

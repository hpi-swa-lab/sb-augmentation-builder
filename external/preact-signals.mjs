/* esm.sh - esbuild bundle(@preact/signals@1.2.2) es2022 production */
import{Component as k,options as b,isValidElement as U}from"/stable/preact@10.19.2/es2022/preact.mjs";import{useMemo as l,useRef as g,useEffect as E}from"/stable/preact@10.19.2/es2022/hooks.js";import{Signal as $,computed as h,signal as y,effect as d}from"/v135/@preact/signals-core@1.5.0/es2022/signals-core.mjs";import{Signal as O,batch as P,computed as R,effect as T,signal as q,untracked as z}from"/v135/@preact/signals-core@1.5.0/es2022/signals-core.mjs";var s,p;function a(e,n){b[e]=n.bind(null,b[e]||function(){})}function c(e){p&&p(),p=e&&e.S()}function S(e){var n=this,t=e.data,i=w(t);i.value=t;var u=l(function(){for(var r=n.__v;r=r.__;)if(r.__c){r.__c.__$f|=4;break}return n.__$u.c=function(){var f;!U(u.peek())&&((f=n.base)==null?void 0:f.nodeType)===3?n.base.data=u.peek():(n.__$f|=1,n.setState({}))},h(function(){var f=i.value.value;return f===0?0:f===!0?"":f||""})},[]);return u.value}S.displayName="_st";Object.defineProperties($.prototype,{constructor:{configurable:!0,value:void 0},type:{configurable:!0,value:S},props:{configurable:!0,get:function(){return{data:this}}},__b:{configurable:!0,value:1}});a("__b",function(e,n){if(typeof n.type=="string"){var t,i=n.props;for(var u in i)if(u!=="children"){var r=i[u];r instanceof $&&(t||(n.__np=t={}),t[u]=r,i[u]=r.peek())}}e(n)});a("__r",function(e,n){c();var t,i=n.__c;i&&(i.__$f&=-2,(t=i.__$u)===void 0&&(i.__$u=t=function(u){var r;return d(function(){r=this}),r.c=function(){i.__$f|=1,i.setState({})},r}())),s=i,c(t),e(n)});a("__e",function(e,n,t,i){c(),s=void 0,e(n,t,i)});a("diffed",function(e,n){c(),s=void 0;var t;if(typeof n.type=="string"&&(t=n.__e)){var i=n.__np,u=n.props;if(i){var r=t.U;if(r)for(var f in r){var o=r[f];o!==void 0&&!(f in i)&&(o.d(),r[f]=void 0)}else t.U=r={};for(var _ in i){var v=r[_],m=i[_];v===void 0?(v=C(t,_,m,u),r[_]=v):v.o(m,u)}}}e(n)});function C(e,n,t,i){var u=n in e&&e.ownerSVGElement===void 0,r=y(t);return{o:function(f,o){r.value=f,i=o},d:d(function(){var f=r.value.value;i[n]!==f&&(i[n]=f,u?e[n]=f:f?e.setAttribute(n,f):e.removeAttribute(n))})}}a("unmount",function(e,n){if(typeof n.type=="string"){var t=n.__e;if(t){var i=t.U;if(i){t.U=void 0;for(var u in i){var r=i[u];r&&r.d()}}}}else{var f=n.__c;if(f){var o=f.__$u;o&&(f.__$u=void 0,o.d())}}e(n)});a("__h",function(e,n,t,i){(i<3||i===9)&&(n.__$f|=2),e(n,t,i)});k.prototype.shouldComponentUpdate=function(e,n){var t=this.__$u;if(!(t&&t.s!==void 0||4&this.__$f)||3&this.__$f)return!0;for(var i in n)return!0;for(var u in e)if(u!=="__source"&&e[u]!==this.props[u])return!0;for(var r in this.props)if(!(r in e))return!0;return!1};function w(e){return l(function(){return y(e)},[])}function j(e){var n=g(e);return n.current=e,s.__$f|=4,l(function(){return h(function(){return n.current()})},[])}function G(e){var n=g(e);n.current=e,E(function(){return d(function(){return n.current()})},[])}export{O as Signal,P as batch,R as computed,T as effect,q as signal,z as untracked,j as useComputed,w as useSignal,G as useSignalEffect};
//# sourceMappingURL=signals.mjs.map
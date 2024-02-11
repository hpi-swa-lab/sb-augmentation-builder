/* esm.sh - esbuild bundle(@preact/signals-core@1.5.0) es2022 production */
function d(){throw new Error("Cycle detected")}var O=Symbol.for("preact-signals");function c(){if(s>1)s--;else{for(var t,i=!1;e!==void 0;){var o=e;for(e=void 0,p++;o!==void 0;){var r=o.o;if(o.o=void 0,o.f&=-3,!(8&o.f)&&S(o))try{o.c()}catch(g){i||(t=g,i=!0)}o=r}}if(p=0,s--,i)throw t}}function k(t){if(s>0)return t();s++;try{return t()}finally{c()}}var f=void 0,a=0;function E(t){if(a>0)return t();var i=f;f=void 0,a++;try{return t()}finally{a--,f=i}}var e=void 0,s=0,p=0,u=0;function l(t){if(f!==void 0){var i=t.n;if(i===void 0||i.t!==f)return i={i:0,S:t,p:f.s,n:void 0,t:f,e:void 0,x:void 0,r:i},f.s!==void 0&&(f.s.n=i),f.s=i,t.n=i,32&f.f&&t.S(i),i;if(i.i===-1)return i.i=0,i.n!==void 0&&(i.n.p=i.p,i.p!==void 0&&(i.p.n=i.n),i.p=f.s,i.n=void 0,f.s.n=i,f.s=i),i}}function n(t){this.v=t,this.i=0,this.n=void 0,this.t=void 0}n.prototype.brand=O;n.prototype.h=function(){return!0};n.prototype.S=function(t){this.t!==t&&t.e===void 0&&(t.x=this.t,this.t!==void 0&&(this.t.e=t),this.t=t)};n.prototype.U=function(t){if(this.t!==void 0){var i=t.e,o=t.x;i!==void 0&&(i.x=o,t.e=void 0),o!==void 0&&(o.e=i,t.x=void 0),t===this.t&&(this.t=o)}};n.prototype.subscribe=function(t){var i=this;return N(function(){var o=i.value,r=32&this.f;this.f&=-33;try{t(o)}finally{this.f|=r}})};n.prototype.valueOf=function(){return this.value};n.prototype.toString=function(){return this.value+""};n.prototype.toJSON=function(){return this.value};n.prototype.peek=function(){return this.v};Object.defineProperty(n.prototype,"value",{get:function(){var t=l(this);return t!==void 0&&(t.i=this.i),this.v},set:function(t){if(f instanceof h&&function(){throw new Error("Computed cannot have side-effects")}(),t!==this.v){p>100&&d(),this.v=t,this.i++,u++,s++;try{for(var i=this.t;i!==void 0;i=i.x)i.t.N()}finally{c()}}}});function m(t){return new n(t)}function S(t){for(var i=t.s;i!==void 0;i=i.n)if(i.S.i!==i.i||!i.S.h()||i.S.i!==i.i)return!0;return!1}function w(t){for(var i=t.s;i!==void 0;i=i.n){var o=i.S.n;if(o!==void 0&&(i.r=o),i.S.n=i,i.i=-1,i.n===void 0){t.s=i;break}}}function x(t){for(var i=t.s,o=void 0;i!==void 0;){var r=i.p;i.i===-1?(i.S.U(i),r!==void 0&&(r.n=i.n),i.n!==void 0&&(i.n.p=r)):o=i,i.S.n=i.r,i.r!==void 0&&(i.r=void 0),i=r}t.s=o}function h(t){n.call(this,void 0),this.x=t,this.s=void 0,this.g=u-1,this.f=4}(h.prototype=new n).h=function(){if(this.f&=-3,1&this.f)return!1;if((36&this.f)==32||(this.f&=-5,this.g===u))return!0;if(this.g=u,this.f|=1,this.i>0&&!S(this))return this.f&=-2,!0;var t=f;try{w(this),f=this;var i=this.x();(16&this.f||this.v!==i||this.i===0)&&(this.v=i,this.f&=-17,this.i++)}catch(o){this.v=o,this.f|=16,this.i++}return f=t,x(this),this.f&=-2,!0};h.prototype.S=function(t){if(this.t===void 0){this.f|=36;for(var i=this.s;i!==void 0;i=i.n)i.S.S(i)}n.prototype.S.call(this,t)};h.prototype.U=function(t){if(this.t!==void 0&&(n.prototype.U.call(this,t),this.t===void 0)){this.f&=-33;for(var i=this.s;i!==void 0;i=i.n)i.S.U(i)}};h.prototype.N=function(){if(!(2&this.f)){this.f|=6;for(var t=this.t;t!==void 0;t=t.x)t.t.N()}};h.prototype.peek=function(){if(this.h()||d(),16&this.f)throw this.v;return this.v};Object.defineProperty(h.prototype,"value",{get:function(){1&this.f&&d();var t=l(this);if(this.h(),t!==void 0&&(t.i=this.i),16&this.f)throw this.v;return this.v}});function j(t){return new h(t)}function b(t){var i=t.u;if(t.u=void 0,typeof i=="function"){s++;var o=f;f=void 0;try{i()}catch(r){throw t.f&=-2,t.f|=8,y(t),r}finally{f=o,c()}}}function y(t){for(var i=t.s;i!==void 0;i=i.n)i.S.U(i);t.x=void 0,t.s=void 0,b(t)}function U(t){if(f!==this)throw new Error("Out-of-order effect");x(this),f=t,this.f&=-2,8&this.f&&y(this),c()}function v(t){this.x=t,this.u=void 0,this.s=void 0,this.o=void 0,this.f=32}v.prototype.c=function(){var t=this.S();try{if(8&this.f||this.x===void 0)return;var i=this.x();typeof i=="function"&&(this.u=i)}finally{t()}};v.prototype.S=function(){1&this.f&&d(),this.f|=1,this.f&=-9,b(this),w(this),s++;var t=f;return f=this,U.bind(this,t)};v.prototype.N=function(){2&this.f||(this.f|=2,this.o=e,e=this)};v.prototype.d=function(){this.f|=8,1&this.f||y(this)};function N(t){var i=new v(t);try{i.c()}catch(o){throw i.d(),o}return i.d.bind(i)}export{n as Signal,k as batch,j as computed,N as effect,m as signal,E as untracked};
//# sourceMappingURL=signals-core.mjs.map
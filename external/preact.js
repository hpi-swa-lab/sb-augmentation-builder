/* esm.sh - esbuild bundle(preact@10.19.3) es2022 production */
var D,a,J,ne,C,j,K,$,Q,E={},X=[],oe=/acit|ex(?:s|g|n|p|$)|rph|grid|ows|mnc|ntw|ine[ch]|zoo|^ord|itera/i,F=Array.isArray;function b(e,_){for(var t in _)e[t]=_[t];return e}function Y(e){var _=e.parentNode;_&&_.removeChild(e)}function re(e,_,t){var i,o,r,l={};for(r in _)r=="key"?i=_[r]:r=="ref"?o=_[r]:l[r]=_[r];if(arguments.length>2&&(l.children=arguments.length>3?D.call(arguments,2):t),typeof e=="function"&&e.defaultProps!=null)for(r in e.defaultProps)l[r]===void 0&&(l[r]=e.defaultProps[r]);return S(e,l,i,o,null)}function S(e,_,t,i,o){var r={type:e,props:_,key:t,ref:i,__k:null,__:null,__b:0,__e:null,__d:void 0,__c:null,constructor:void 0,__v:o??++J,__i:-1,__u:0};return o==null&&a.vnode!=null&&a.vnode(r),r}function ae(){return{current:null}}function H(e){return e.children}function W(e,_){this.props=e,this.context=_}function P(e,_){if(_==null)return e.__?P(e.__,e.__i+1):null;for(var t;_<e.__k.length;_++)if((t=e.__k[_])!=null&&t.__e!=null)return t.__e;return typeof e.type=="function"?P(e):null}function Z(e){var _,t;if((e=e.__)!=null&&e.__c!=null){for(e.__e=e.__c.base=null,_=0;_<e.__k.length;_++)if((t=e.__k[_])!=null&&t.__e!=null){e.__e=e.__c.base=t.__e;break}return Z(e)}}function I(e){(!e.__d&&(e.__d=!0)&&C.push(e)&&!A.__r++||j!==a.debounceRendering)&&((j=a.debounceRendering)||K)(A)}function A(){var e,_,t,i,o,r,l,s,f;for(C.sort($);e=C.shift();)e.__d&&(_=C.length,i=void 0,r=(o=(t=e).__v).__e,s=[],f=[],(l=t.__P)&&((i=b({},o)).__v=o.__v+1,a.vnode&&a.vnode(i),B(l,i,o,t.__n,l.ownerSVGElement!==void 0,32&o.__u?[r]:null,s,r??P(o),!!(32&o.__u),f),i.__.__k[i.__i]=i,te(s,i,f),i.__e!=r&&Z(i)),C.length>_&&C.sort($));A.__r=0}function ee(e,_,t,i,o,r,l,s,f,u,p){var n,m,c,h,k,v=i&&i.__k||X,d=_.length;for(t.__d=f,ie(t,_,v),f=t.__d,n=0;n<d;n++)(c=t.__k[n])!=null&&typeof c!="boolean"&&typeof c!="function"&&(m=c.__i===-1?E:v[c.__i]||E,c.__i=n,B(e,c,m,o,r,l,s,f,u,p),h=c.__e,c.ref&&m.ref!=c.ref&&(m.ref&&O(m.ref,null,c),p.push(c.ref,c.__c||h,c)),k==null&&h!=null&&(k=h),65536&c.__u||m.__k===c.__k?f=_e(c,f,e):typeof c.type=="function"&&c.__d!==void 0?f=c.__d:h&&(f=h.nextSibling),c.__d=void 0,c.__u&=-196609);t.__d=f,t.__e=k}function ie(e,_,t){var i,o,r,l,s,f=_.length,u=t.length,p=u,n=0;for(e.__k=[],i=0;i<f;i++)(o=e.__k[i]=(o=_[i])==null||typeof o=="boolean"||typeof o=="function"?null:typeof o=="string"||typeof o=="number"||typeof o=="bigint"||o.constructor==String?S(null,o,null,null,o):F(o)?S(H,{children:o},null,null,null):o.constructor===void 0&&o.__b>0?S(o.type,o.props,o.key,o.ref?o.ref:null,o.__v):o)!=null?(o.__=e,o.__b=e.__b+1,s=se(o,t,l=i+n,p),o.__i=s,r=null,s!==-1&&(p--,(r=t[s])&&(r.__u|=131072)),r==null||r.__v===null?(s==-1&&n--,typeof o.type!="function"&&(o.__u|=65536)):s!==l&&(s===l+1?n++:s>l?p>f-l?n+=s-l:n--:n=s<l&&s==l-1?s-l:0,s!==i+n&&(o.__u|=65536))):(r=t[i])&&r.key==null&&r.__e&&(r.__e==e.__d&&(e.__d=P(r)),R(r,r,!1),t[i]=null,p--);if(p)for(i=0;i<u;i++)(r=t[i])!=null&&!(131072&r.__u)&&(r.__e==e.__d&&(e.__d=P(r)),R(r,r))}function _e(e,_,t){var i,o;if(typeof e.type=="function"){for(i=e.__k,o=0;i&&o<i.length;o++)i[o]&&(i[o].__=e,_=_e(i[o],_,t));return _}return e.__e!=_&&(t.insertBefore(e.__e,_||null),_=e.__e),_&&_.nextSibling}function le(e,_){return _=_||[],e==null||typeof e=="boolean"||(F(e)?e.some(function(t){le(t,_)}):_.push(e)),_}function se(e,_,t,i){var o=e.key,r=e.type,l=t-1,s=t+1,f=_[t];if(f===null||f&&o==f.key&&r===f.type)return t;if(i>(f!=null&&!(131072&f.__u)?1:0))for(;l>=0||s<_.length;){if(l>=0){if((f=_[l])&&!(131072&f.__u)&&o==f.key&&r===f.type)return l;l--}if(s<_.length){if((f=_[s])&&!(131072&f.__u)&&o==f.key&&r===f.type)return s;s++}}return-1}function z(e,_,t){_[0]==="-"?e.setProperty(_,t??""):e[_]=t==null?"":typeof t!="number"||oe.test(_)?t:t+"px"}function M(e,_,t,i,o){var r;e:if(_==="style")if(typeof t=="string")e.style.cssText=t;else{if(typeof i=="string"&&(e.style.cssText=i=""),i)for(_ in i)t&&_ in t||z(e.style,_,"");if(t)for(_ in t)i&&t[_]===i[_]||z(e.style,_,t[_])}else if(_[0]==="o"&&_[1]==="n")r=_!==(_=_.replace(/(PointerCapture)$|Capture$/,"$1")),_=_.toLowerCase()in e?_.toLowerCase().slice(2):_.slice(2),e.l||(e.l={}),e.l[_+r]=t,t?i?t.u=i.u:(t.u=Date.now(),e.addEventListener(_,r?q:G,r)):e.removeEventListener(_,r?q:G,r);else{if(o)_=_.replace(/xlink(H|:h)/,"h").replace(/sName$/,"s");else if(_!=="width"&&_!=="height"&&_!=="href"&&_!=="list"&&_!=="form"&&_!=="tabIndex"&&_!=="download"&&_!=="rowSpan"&&_!=="colSpan"&&_!=="role"&&_ in e)try{e[_]=t??"";break e}catch{}typeof t=="function"||(t==null||t===!1&&_[4]!=="-"?e.removeAttribute(_):e.setAttribute(_,t))}}function G(e){var _=this.l[e.type+!1];if(e.t){if(e.t<=_.u)return}else e.t=Date.now();return _(a.event?a.event(e):e)}function q(e){return this.l[e.type+!0](a.event?a.event(e):e)}function B(e,_,t,i,o,r,l,s,f,u){var p,n,m,c,h,k,v,d,y,x,T,w,V,U,N,g=_.type;if(_.constructor!==void 0)return null;128&t.__u&&(f=!!(32&t.__u),r=[s=_.__e=t.__e]),(p=a.__b)&&p(_);e:if(typeof g=="function")try{if(d=_.props,y=(p=g.contextType)&&i[p.__c],x=p?y?y.props.value:p.__:i,t.__c?v=(n=_.__c=t.__c).__=n.__E:("prototype"in g&&g.prototype.render?_.__c=n=new g(d,x):(_.__c=n=new W(d,x),n.constructor=g,n.render=ce),y&&y.sub(n),n.props=d,n.state||(n.state={}),n.context=x,n.__n=i,m=n.__d=!0,n.__h=[],n._sb=[]),n.__s==null&&(n.__s=n.state),g.getDerivedStateFromProps!=null&&(n.__s==n.state&&(n.__s=b({},n.__s)),b(n.__s,g.getDerivedStateFromProps(d,n.__s))),c=n.props,h=n.state,n.__v=_,m)g.getDerivedStateFromProps==null&&n.componentWillMount!=null&&n.componentWillMount(),n.componentDidMount!=null&&n.__h.push(n.componentDidMount);else{if(g.getDerivedStateFromProps==null&&d!==c&&n.componentWillReceiveProps!=null&&n.componentWillReceiveProps(d,x),!n.__e&&(n.shouldComponentUpdate!=null&&n.shouldComponentUpdate(d,n.__s,x)===!1||_.__v===t.__v)){for(_.__v!==t.__v&&(n.props=d,n.state=n.__s,n.__d=!1),_.__e=t.__e,_.__k=t.__k,_.__k.forEach(function(L){L&&(L.__=_)}),T=0;T<n._sb.length;T++)n.__h.push(n._sb[T]);n._sb=[],n.__h.length&&l.push(n);break e}n.componentWillUpdate!=null&&n.componentWillUpdate(d,n.__s,x),n.componentDidUpdate!=null&&n.__h.push(function(){n.componentDidUpdate(c,h,k)})}if(n.context=x,n.props=d,n.__P=e,n.__e=!1,w=a.__r,V=0,"prototype"in g&&g.prototype.render){for(n.state=n.__s,n.__d=!1,w&&w(_),p=n.render(n.props,n.state,n.context),U=0;U<n._sb.length;U++)n.__h.push(n._sb[U]);n._sb=[]}else do n.__d=!1,w&&w(_),p=n.render(n.props,n.state,n.context),n.state=n.__s;while(n.__d&&++V<25);n.state=n.__s,n.getChildContext!=null&&(i=b(b({},i),n.getChildContext())),m||n.getSnapshotBeforeUpdate==null||(k=n.getSnapshotBeforeUpdate(c,h)),ee(e,F(N=p!=null&&p.type===H&&p.key==null?p.props.children:p)?N:[N],_,t,i,o,r,l,s,f,u),n.base=_.__e,_.__u&=-161,n.__h.length&&l.push(n),v&&(n.__E=n.__=null)}catch(L){_.__v=null,f||r!=null?(_.__e=s,_.__u|=f?160:32,r[r.indexOf(s)]=null):(_.__e=t.__e,_.__k=t.__k),a.__e(L,_,t)}else r==null&&_.__v===t.__v?(_.__k=t.__k,_.__e=t.__e):_.__e=ue(t.__e,_,t,i,o,r,l,f,u);(p=a.diffed)&&p(_)}function te(e,_,t){_.__d=void 0;for(var i=0;i<t.length;i++)O(t[i],t[++i],t[++i]);a.__c&&a.__c(_,e),e.some(function(o){try{e=o.__h,o.__h=[],e.some(function(r){r.call(o)})}catch(r){a.__e(r,o.__v)}})}function ue(e,_,t,i,o,r,l,s,f){var u,p,n,m,c,h,k,v=t.props,d=_.props,y=_.type;if(y==="svg"&&(o=!0),r!=null){for(u=0;u<r.length;u++)if((c=r[u])&&"setAttribute"in c==!!y&&(y?c.localName===y:c.nodeType===3)){e=c,r[u]=null;break}}if(e==null){if(y===null)return document.createTextNode(d);e=o?document.createElementNS("http://www.w3.org/2000/svg",y):document.createElement(y,d.is&&d),r=null,s=!1}if(y===null)v===d||s&&e.data===d||(e.data=d);else{if(r=r&&D.call(e.childNodes),v=t.props||E,!s&&r!=null)for(v={},u=0;u<e.attributes.length;u++)v[(c=e.attributes[u]).name]=c.value;for(u in v)c=v[u],u=="children"||(u=="dangerouslySetInnerHTML"?n=c:u==="key"||u in d||M(e,u,null,c,o));for(u in d)c=d[u],u=="children"?m=c:u=="dangerouslySetInnerHTML"?p=c:u=="value"?h=c:u=="checked"?k=c:u==="key"||s&&typeof c!="function"||v[u]===c||M(e,u,c,v[u],o);if(p)s||n&&(p.__html===n.__html||p.__html===e.innerHTML)||(e.innerHTML=p.__html),_.__k=[];else if(n&&(e.innerHTML=""),ee(e,F(m)?m:[m],_,t,i,o&&y!=="foreignObject",r,l,r?r[0]:t.__k&&P(t,0),s,f),r!=null)for(u=r.length;u--;)r[u]!=null&&Y(r[u]);s||(u="value",h!==void 0&&(h!==e[u]||y==="progress"&&!h||y==="option"&&h!==v[u])&&M(e,u,h,v[u],!1),u="checked",k!==void 0&&k!==e[u]&&M(e,u,k,v[u],!1))}return e}function O(e,_,t){try{typeof e=="function"?e(_):e.current=_}catch(i){a.__e(i,t)}}function R(e,_,t){var i,o;if(a.unmount&&a.unmount(e),(i=e.ref)&&(i.current&&i.current!==e.__e||O(i,null,_)),(i=e.__c)!=null){if(i.componentWillUnmount)try{i.componentWillUnmount()}catch(r){a.__e(r,_)}i.base=i.__P=null,e.__c=void 0}if(i=e.__k)for(o=0;o<i.length;o++)i[o]&&R(i[o],_,t||typeof e.type!="function");t||e.__e==null||Y(e.__e),e.__=e.__e=e.__d=void 0}function ce(e,_,t){return this.constructor(e,t)}function fe(e,_,t){var i,o,r,l;a.__&&a.__(e,_),o=(i=typeof t=="function")?null:t&&t.__k||_.__k,r=[],l=[],B(_,e=(!i&&t||_).__k=re(H,null,[e]),o||E,E,_.ownerSVGElement!==void 0,!i&&t?[t]:o?null:_.firstChild?D.call(_.childNodes):null,r,!i&&t?t:o?o.__e:_.firstChild,i,l),te(r,e,l)}function pe(e,_){fe(e,_,pe)}function de(e,_,t){var i,o,r,l,s=b({},e.props);for(r in e.type&&e.type.defaultProps&&(l=e.type.defaultProps),_)r=="key"?i=_[r]:r=="ref"?o=_[r]:s[r]=_[r]===void 0&&l!==void 0?l[r]:_[r];return arguments.length>2&&(s.children=arguments.length>3?D.call(arguments,2):t),S(e.type,s,i||e.key,o||e.ref,null)}function he(e,_){var t={__c:_="__cC"+Q++,__:e,Consumer:function(i,o){return i.children(o)},Provider:function(i){var o,r;return this.getChildContext||(o=[],(r={})[_]=this,this.getChildContext=function(){return r},this.shouldComponentUpdate=function(l){this.props.value!==l.value&&o.some(function(s){s.__e=!0,I(s)})},this.sub=function(l){o.push(l);var s=l.componentWillUnmount;l.componentWillUnmount=function(){o.splice(o.indexOf(l),1),s&&s.call(l)}}),i.children}};return t.Provider.__=t.Consumer.contextType=t}D=X.slice,a={__e:function(e,_,t,i){for(var o,r,l;_=_.__;)if((o=_.__c)&&!o.__)try{if((r=o.constructor)&&r.getDerivedStateFromError!=null&&(o.setState(r.getDerivedStateFromError(e)),l=o.__d),o.componentDidCatch!=null&&(o.componentDidCatch(e,i||{}),l=o.__d),l)return o.__E=o}catch(s){e=s}throw e}},J=0,ne=function(e){return e!=null&&e.constructor==null},W.prototype.setState=function(e,_){var t;t=this.__s!=null&&this.__s!==this.state?this.__s:this.__s=b({},this.state),typeof e=="function"&&(e=e(b({},t),this.props)),e&&b(t,e),e!=null&&this.__v&&(_&&this._sb.push(_),I(this))},W.prototype.forceUpdate=function(e){this.__v&&(this.__e=!0,e&&this.__h.push(e),I(this))},W.prototype.render=H,C=[],K=typeof Promise=="function"?Promise.prototype.then.bind(Promise.resolve()):setTimeout,$=function(e,_){return e.__v.__b-_.__v.__b},A.__r=0,Q=0;export{W as Component,H as Fragment,de as cloneElement,he as createContext,re as createElement,ae as createRef,re as h,pe as hydrate,ne as isValidElement,a as options,fe as render,le as toChildArray};
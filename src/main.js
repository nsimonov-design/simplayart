(function(){
  var head=document.querySelector('.site-head');
  var onScroll=function(){head&&head.classList.toggle('scrolled',window.scrollY>8)};
  window.addEventListener('scroll',onScroll,{passive:true});onScroll();

  var burger=document.querySelector('.burger');
  if(burger){burger.addEventListener('click',function(){
    var open=document.body.classList.toggle('nav-open');burger.setAttribute('aria-expanded',open);
  });
  document.querySelectorAll('.nav a').forEach(function(a){a.addEventListener('click',function(){document.body.classList.remove('nav-open');burger.setAttribute('aria-expanded',false)})});}

  var reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Телефон: Telegram и Instagram открываем сразу в приложении — в браузере Instagram в РФ без VPN
  // не открывается, а t.me у части провайдеров работает с перебоями. Нет приложения — через 1,5 с откроется сайт.
  if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)){
    document.addEventListener('click',function(e){
      var a=e.target.closest&&e.target.closest('a[href]');if(!a||e.defaultPrevented)return;
      var h=a.href,m,app=null;
      if((m=h.match(/^https:\/\/t\.me\/(\w+)\/?$/)))app='tg://resolve?domain='+m[1];
      else if((m=h.match(/^https:\/\/(?:www\.)?instagram\.com\/([\w.]+)\/?$/)))app='instagram://user?username='+m[1];
      if(!app)return;
      e.preventDefault();
      var gone=false,t=setTimeout(function(){if(!gone&&!document.hidden)location.href=h},1500);
      var stop=function(){if(document.hidden){gone=true;clearTimeout(t)}};
      document.addEventListener('visibilitychange',stop);
      window.addEventListener('pagehide',function(){gone=true;clearTimeout(t)},{once:true});
      location.href=app;
    });
  }

  // reveal on scroll
  if('IntersectionObserver' in window && !reduce){
    var ro=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');ro.unobserve(e.target)}})},{rootMargin:'0px 0px -8% 0px'});
    document.querySelectorAll('.reveal').forEach(function(el){ro.observe(el)});
  } else document.querySelectorAll('.reveal').forEach(function(el){el.classList.add('in')});

  // «Собери · Разбери» video cards
  var cards=[].slice.call(document.querySelectorAll('.vcard'));
  cards.forEach(function(card){
    var v=card.querySelector('video'),btns=card.querySelectorAll('.seg button'),pp=card.querySelector('.vplay');
    if(reduce)card.classList.add('paused');
    btns.forEach(function(b){b.addEventListener('click',function(){
      if(b.getAttribute('aria-pressed')==='true')return;
      btns.forEach(function(x){x.setAttribute('aria-pressed',x===b)});
      v.poster=b.dataset.poster;v.src=b.dataset.src;v.load();
      card.classList.remove('paused');var p=v.play();if(p&&p.catch)p.catch(function(){});
    })});
    pp.addEventListener('click',function(){
      if(v.paused){card.classList.remove('paused');v.play()}else{card.classList.add('paused');v.pause()}
    });
  });
  if('IntersectionObserver' in window){
    var vo=new IntersectionObserver(function(es){es.forEach(function(e){
      var card=e.target,v=card.querySelector('video');
      if(e.isIntersecting){
        if(!v.src){v.src=v.dataset.src;v.load()}
        if(!card.classList.contains('paused')){var p=v.play();if(p&&p.catch)p.catch(function(){})}
      } else if(v.src){v.pause()}
    })},{threshold:.35});
    cards.forEach(function(c){vo.observe(c)});
  } else cards.forEach(function(c){var v=c.querySelector('video');v.src=v.dataset.src});
})();

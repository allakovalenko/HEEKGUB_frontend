define(["jquery","underscore","plugin-dependencies","text!./main.html","./control/controller","plugin-components/media-loader","css!./main.css"],function(e,n,i,t,o,r){return function(i){var s=n.template(t),l={$el:e("<div>").addClass("activity-plugin"),show:function(){this.$el.html(s);var e=this.$el.find(".media"),n=this.$el.find(".control");r.setModel(i),e.append(r.render().$el),n.append(o.setResource(i).show())},hide:function(){o.remove(),r.remove()},sizeChange:function(){r.sizeChange()}};return l}});
require([
    "splunkjs/mvc",
    "app/tracing/d3.min",
    "app/tracing/moment.min",
    "splunkjs/mvc/searchmanager",
    "splunkjs/mvc/simplexml/ready!"
], function(
    mvc,
    d3,
    moment,
    SearchManager,
) {
    console.log("Search time!")
    var spans = new SearchManager({
        // This needs to be unique!
        id: "spans123",
        autostart: true,
        cache: false,
        // Configurable!
        earliest_time: "-1w",
        latest_time: "now",
        // From input
        search: "index=main | spath trace_id | search trace_id=8136862305576871663"
    });

    spans.on('search:progress', function(properties) {
        // Print just the event count from the search job
        console.log("IN PROGRESS.\nEvents so far:", properties.content.eventCount);
    });

    spans.on("search:done", function(properties, foo) {
        console.log('SEARCH DONE');
        console.log(properties);
        console.log(foo);

        //var spanResults = splunkjs.mvc.Components.get(properties.content.label);
        console.log("Waiting on results now?");
    });
    spans.on("search:error", function(properties) {
        console.log("SEARCH ERROR");
        console.log(properties);
    });
    var spanResults = spans.data("events", { count: 1000, offset: 0 });
    console.log("Data?")
    spanResults.on("data", function() {
        // Check spanResults.hasData()
        console.log("Results!");
        var finalSpans = spanResults.data().rows.map(x => JSON.parse(x[3]));
        // console.log(finalSpans);
        drawTrace(finalSpans);
    });

    const addSpan = (span, tree, depth) => {
        console.log("Looking for home for " + span.id + " in " + tree.id);
          if(span.parent_id == tree.id) {
            children = tree.children || [];
          console.log(depth);
              span.depth = depth;
              children.push(span);
          tree.children = children;
          console.log("added child");
          return true;
        } else if(tree.children) {
            children = tree.children;
            for(i = 0; i < children.length; i++) {
                  subSpan = children[i];
            //console.log("\tdescending into " + subSpan.spanid);
              var found = addSpan(span, subSpan, depth + 1);
            if(found) {
                return found;
            }
              }
        } else {
            //console.log("Didn't find a span for " + span.spanid + " in " + tree.spanid);
            return false;
        }
    };
      
    const traceDepth = (tree) => {
          var level = 1;
          if (tree.children == undefined || tree.children.length == 0) return level;
      
          var depth = traceDepth(tree.children) + 1;
          level = Math.max(depth, level);
          return level;
    }
      
    const clickit = (event) => {
        d3.selectAll('.span').classed("span-active", false);
        d3.select("#span-" + event.id).classed("span-active", true);
        var label = event.id + " " + event.service + ": " + event.name;
        d3.select("#current").text(label);
    }
      
    const services = {
        "bapi-srv": "rgba(103, 114, 229, .5)",
        "mproxy-srv": "rgba(50, 50, 93, .5)",
        "deepest-srv": "rgba(252, 214, 105, .5)"
    }
      
    const drawTrace = (spans) => {

        spans = [{"trace_id":"8136862305576871663","id":"3638690245376735944","parent_id": undefined,"start_timestamp":1537798607.356346,"end_timestamp":1537798607.3573287,"duration_ns":982579,"error":false,"service":"mproxy","tags":{"action_id":"qa-f1.northwest-4.apiori.com/aiMz6ama7L-5917303","api_method":"CreateChargeMethod","availability-zone":"us-west-2b","collection":"charges","command":"update","cursor_id":"0","cursor_not_found":"false","db":"chargedb_00b5","host_cluster":"northwest","host_contact":"storage","host_domain":"stripe.io","host_env":"qa","host_lsbdistcodename":"xenial","host_set":"nil","host_type":"mproxy","instance-type":"c3.xlarge","merchant":"acct_1AtPFBKYDGCP0bDS","mproxy_service_tier":"true","name":"mproxy-request.command.update.charges","nreturned":"1","op_timeout":"30","opcode_name":"OP_QUERY","operation":"command","project":"acquiring_auth","query_failure":"false","read_pref":"primary","replset":"shard_bi","short_name":"mproxy-request","ssf_span_id":"1955155556","ssf_trace_id":"8136862305576871663","stack_frame":"eac7c33c:lib/db/model/mixins/disables_trivial_writes.rb:49","starting_from":"0","svcname":"bapi-srv","w":"1"},"indicator":true,"name":"mproxy-request.command.update.charges"}];

        var traceStart;
        var traceEnd;
        
        var rootSpan;
        for (i = 0; i < spans.length; i++) { 
            var span = spans[i];
            if(span.parent_id == undefined) {
                rootSpan = span;
            }
        }
        if(rootSpan == undefined) {
            console.log("No parent span found");
        } else {
            console.log("Found root span!")
            console.log(rootSpan);
        }
        rootSpan.depth = 0;
        spans.forEach(function(span) {
            if(span.parent_id != undefined) {
                addSpan(span, rootSpan, 1);
            }
            if(traceStart == undefined || (span.start_timestamp < traceStart)) {
                traceStart = span.start_timestamp;
            }
            if(traceEnd == undefined || (span.end_timestamp > traceEnd)) {
                traceEnd = span.end_timestamp;
            }
        });
        
        console.log("start is " + traceStart);
        console.log("end is " + traceEnd);
        console.log("entire duration is " + (traceEnd - traceStart));
        
        var depth = traceDepth(rootSpan);
        
        var margin = {top: 20, right: 40, bottom: 20, left: 20},
            width = 600 - margin.left - margin.right,
            height = 200 - margin.top - margin.bottom;
        
        var x = d3.scaleLinear()
                .range([0, width]);
        x.domain([0, (traceEnd - traceStart) + 12]); // Why do I have to pad this?
        
        var y = d3.scaleLinear()
            .range([0, height]);
        y.domain([0, depth + 1]);
        
        var svg = d3.select("#chart").append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", "0 0 " + width + " " + height)
            .attr("preserveAspectRatio", "xMinYMid")
            .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
        
        //svg.append("g").attr("class", "y axis").call(d3.axisLeft(y));
        svg.append("g").attr("class", "x axis").call(d3.axisTop(x));
        
        svg.selectAll("rect").data(spans).enter().append("rect")
            .attr("id", function(d) { return "span-" + d.spanid })
            .attr("x", function(d) { return x(d.start_timestamp - traceStart); })
            .attr("y", function(d) { return 20 * d.depth + 2; }) //return y(d.depth)
            .attr("rx", 5)
            .attr("ry", 5)
            .attr("width", function(d) { return x(d.duration_ns / 1e9) - 2; }) // nanos!
            .attr("height", function(d) { return 20 - 2; }) // return y(1)
            .attr("class", "span")
            .style("fill", function(d) { return services[d.service] || "rgba(120, 120, 120, .5)"})
            .attr("transform", "translate(2,2)")
            .on("click", clickit, true);
    }
});
// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = '_default';
squiffy.story.id = 'ac0e28f055';
squiffy.story.sections = {
	'_default': {
		'text': "<h1 id=\"not-a-hero\">Not a Hero</h1>\n<p><em>by Rosie_er</em></p>\n<p>Navigate through the story by clicking the links available. Some links may end up being locked if you choose certain paths. You also don&#39;t need to click every link. If you don&#39;t know where to go, look for a link. If there are no links... oops.</p>\n<p>There is currently 1 Chapter.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"To the foreword...\" role=\"link\" tabindex=\"0\">To the foreword...</a></p>",
		'passages': {
		},
	},
	'To the foreword...': {
		'text': "<h2 id=\"foreword\">Foreword</h2>\n<p>This story is inspired by choose your own adventure games and the adventure genre of fantasy novels. The first chapter was written within a day, so please pardon the sloppyness.\nThank you to Ravs_ on twitch helping me kick my butt into gear and continue my writing hobby. Thank you to Ravs_&#39;s mods for allowing this, and thank you to chat for being paitent with me.</p>\n<p>-Your pal, Rosie_er</p>\n<p>Are we ready to <a class=\"squiffy-link link-section\" data-section=\"Chapter 1\" role=\"link\" tabindex=\"0\">begin</a>?</p>",
		'passages': {
		},
	},
	'Chapter 1': {
		'clear': true,
		'text': "<h2 id=\"chapter-1-the-fool\">Chapter 1 - The Fool</h2>\n<p>&quot;<strong>Hello, {label:hero=hero},</strong>&quot; from the darkness the voice echos between your ears.</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"@replace hero=not a hero\" role=\"link\" tabindex=\"0\">&gt; I&#39;m not a hero.</a></p>",
		'passages': {
			'not a hero': {
				'text': "<p><a class=\"squiffy-link link-passage\" data-passage=\"journeyman\" role=\"link\" tabindex=\"0\">journeyman</a>, if you prefer</p>",
			},
			'journeyman': {
				'text': "<p>> Who are you?</p>\n<p>&quot;<strong>You have so much to do, yet so little time.</strong>&quot; the voice continued, &quot;<strong><a class=\"squiffy-link link-section\" data-section=\"Follow\" role=\"link\" tabindex=\"0\">Follow</a> me.</strong>&quot;</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"who are you\" role=\"link\" tabindex=\"0\">&gt; I said who <em>are</em> you?</a></p>",
			},
			'who are you': {
				'text': "<p>&quot;<strong>You cannot begin to understand who I am or what my presence means. But I will give you this- heed my warning, journeyman. Do not pay mind to the temptation of the gods. They bare no goodwill towards you humans.</strong>&quot;</p>",
			},
		},
	},
	'Follow': {
		'text': "<p>From the darkness you see a glimmer of purples and blues of the void around you. As your eyes begin to focus, you see the marble pillars that tower above you, directing you forward. In front of you, you see a figure, still clouded from your vision.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue1\" role=\"link\" tabindex=\"0\">You squint...</a></p>",
		'passages': {
		},
	},
	'_continue1': {
		'text': "<p>The figure, still obscured, reaches into your mind, &quot;<strong>Why do you <a class=\"squiffy-link link-passage\" data-passage=\"hesitate\" role=\"link\" tabindex=\"0\">hesitate</a>? <a class=\"squiffy-link link-section\" data-section=\"Follow.\" role=\"link\" tabindex=\"0\">Follow.</a></strong>&quot;</p>",
		'passages': {
			'hesitate': {
				'text': "<p>You take a breath, and pause to <a class=\"squiffy-link link-section\" data-section=\"look around\" role=\"link\" tabindex=\"0\">look around</a> at the void beyond the pillars.</p>",
			},
		},
	},
	'look around': {
		'text': "<p>As your gaze dances between the marble pillars, you see something in the corner of your eye. You follow the red glint, but the feeling quickly fades.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue2\" role=\"link\" tabindex=\"0\">&gt; Are we being watched?</a></p>",
		'passages': {
		},
	},
	'_continue2': {
		'text': "<p>&quot;<strong>Quickly now. <a class=\"squiffy-link link-section\" data-section=\"Follow.\" role=\"link\" tabindex=\"0\">Follow.</a></strong>&quot;</p>",
		'passages': {
		},
	},
	'Follow.': {
		'text': "<p>As you step forward towards the figure, the ground beneath you begins to sway.</p>\n<p>&quot;<strong>It seems we had less time than I anticipated.</strong>&quot; The voice fades as a force pushes you <a class=\"squiffy-link link-section\" data-section=\"forward\" role=\"link\" tabindex=\"0\">forward</a>.</p>",
		'passages': {
		},
	},
	'forward': {
		'clear': true,
		'text': "<p>Your eyes shoot open as the force, a hand, presses on your back again through your hammock.</p>\n<p>&quot;Captain said everyone, that means you too friend. You may be a passenger but you best do what the captain orders. Up <a class=\"squiffy-link link-passage\" data-passage=\"to the deck\" role=\"link\" tabindex=\"0\">to the deck</a> with you.&quot; The ship&#39;s first mate Barnes stands over your hammock, &quot;Hurry along.&quot;</p>",
		'passages': {
			'to the deck': {
				'text': "<p>The dream fades from your mind as you center yourself. As you hurriedly lace your boots you think over <a class=\"squiffy-link link-passage\" data-passage=\"your plan\" role=\"link\" tabindex=\"0\">your plan</a>.</p>",
			},
			'your plan': {
				'text': "<p>You are the hopeful adventurer named {name}, who embarked last week on a voyage to the continent of Solaria in hopes to find an end for your family&#39;s <a class=\"squiffy-link link-passage\" data-passage=\"curse\" role=\"link\" tabindex=\"0\">curse</a>.</p>",
				'js': function() {
					let name = prompt("What is your name?", "Harvey")
					squiffy.set("name", name ?? "Harvey" )
				},
			},
			'curse': {
				'text': "<p>The curse that upon the day of the 33rd year of your life, you will fall into a fit of magical energy, destroying all those around you, including yourself. You are 32 as of today.</p>\n<p>You shiver at the thought.\nLet&#39;s <a class=\"squiffy-link link-section\" data-section=\"try to forget\" role=\"link\" tabindex=\"0\">try to forget</a> for now...</p>",
			},
		},
	},
	'try to forget': {
		'clear': true,
		'text': "<p>You hurry to the deck with the rest of the passengers and crew.</p>\n<p>As you reach the deck, a man stands from his seat on a crate nearby. He approaches you, a deck of cards in his hand, and a kind smile on his face.</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Croft intro\" role=\"link\" tabindex=\"0\">&gt; Can I help you?</a></p>",
		'passages': {
		},
	},
	'Croft intro': {
		'text': "<p>&quot;No, not particularly,&quot; the stranger says in his calm baratone voice. &quot;Though I may be able to provide some help to you.&quot;</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Croft offer\" role=\"link\" tabindex=\"0\">&gt; Go on...</a></p>",
		'passages': {
			'Croft offer': {
				'text': "<p>&quot;My name is Croft. The cards tell me I&#39;m to provide you a reading,&quot; the stranger holds up his <a class=\"squiffy-link link-passage\" data-passage=\"deck of cards\" role=\"link\" tabindex=\"0\">deck of cards</a>. Your brow furrowed with sceptisism.</p>",
			},
			'deck of cards': {
				'text': "<p>You recognize the cards as Tarotta cards, a deck of divination, typically weilded by fortune tellers.</p>\n<p>&quot;I can promise the reading will cost you nothing but a few spare moments of your time.&quot; Croft smiles warmly. &quot;So what do you say, would you like <a class=\"squiffy-link link-section\" data-section=\"a reading\" role=\"link\" tabindex=\"0\">a reading</a>? Or is the future one that you wish to keep <a class=\"squiffy-link link-section\" data-section=\"a mystery\" role=\"link\" tabindex=\"0\">a mystery</a>?&quot;</p>",
			},
		},
	},
	'a mystery': {
		'text': "<p>&quot;I see. The offer is still here for when we meet again.&quot; Croft falls back into the crowd.\n<a class=\"squiffy-link link-section\" data-section=\"Leave\" role=\"link\" tabindex=\"0\">Leave</a></p>",
		'passages': {
		},
	},
	'a reading': {
		'text': "<p>&quot;Wonderful.&quot; He pulls you aside to the crate he was sitting on. His hands move swiftly across the deck of cards as he draws 3 from the top of the deck and lays them infront of you face down, one at a time. &quot;The first represents the Wanderer, you. The second represents the Way, how the next step of your journey lead to. The last represents the Warning, what may lead you astray.&quot;</p>\n<p>Would you like to <a class=\"squiffy-link link-section\" data-section=\"flip the cards\" role=\"link\" tabindex=\"0\">flip the cards</a>?</p>",
		'passages': {
		},
	},
	'flip the cards': {
		'text': "<p><img src=\"https://i.imgur.com/TdVuaxl.png\" alt=\"The Fool (upright), The Hermit (upright), and the Heirophant (reversed)\"></p>\n<p>&quot;<a class=\"squiffy-link link-passage\" data-passage=\"The Fool\" role=\"link\" tabindex=\"0\">The Fool</a>, <a class=\"squiffy-link link-passage\" data-passage=\"The Priestess\" role=\"link\" tabindex=\"0\">The Priestess</a>, <a class=\"squiffy-link link-passage\" data-passage=\"The Hierophant reversed\" role=\"link\" tabindex=\"0\">The Hierophant reversed</a>...&quot; Croft thinks for a moment, &quot;all very interesting outcomes...&quot;</p>\n<p><a class=\"squiffy-link link-section\" data-section=\"Leave\" role=\"link\" tabindex=\"0\">&gt; Thanks for the reading, but I think it&#39;s time for me to leave.</a></p>\n<p><a class=\"squiffy-link link-section\" data-section=\"_continue3\" role=\"link\" tabindex=\"0\">&gt; What does it mean?</a></p>",
		'passages': {
			'The Fool': {
				'text': "<p>The fool is not necessarily an idiot. The card represents stepping into new beginnings, a start of a perilous journey.</p>",
			},
			'The Priestess': {
				'text': "<p>The Priestess, or the High Priestess, represents something or someone just as mysterious as they are powerful.</p>",
			},
			'The Hierophant reversed': {
				'text': "<p>The Hierphant often represents divine leaders, often those representing the gods. Reversed, however, represents corruption of those people, often from an outside source.</p>",
			},
		},
	},
	'_continue3': {
		'text': "<p>&quot;You embark on your journey to Solaria by this very ship, however you have a long perilous journey ahead of you. Watch your step, as things will get dangerous very quickly. The next step will bring to you a mysterious power, one that may be weilded, if done so by the right person. As for the warning, it is an odd one, the reversed Hierophant. Beware those representing the gods, for they being coruptted. An ominous warning, to say the least.&quot; He returns the cards to his deck and stands tall. &quot;That concludes your reading. You have a lot of potential, {name}.&quot;</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"my name\" role=\"link\" tabindex=\"0\">&gt; I don&#39;t recall ever giving you my name...</a></p>",
		'passages': {
			'my name': {
				'text': "<p>&quot;How forgetful on both our parts. I am the divination mage, Oswald C. Croft, at your service.&quot; Croft bows. &quot;It looks as if the captian is here. Best we <a class=\"squiffy-link link-section\" data-section=\"Leave\" role=\"link\" tabindex=\"0\">listen</a> to his announcement.&quot; He fades back into the crowd</p>",
			},
		},
	},
	'Leave': {
		'clear': true,
		'text': "<p>You turn and walk back into the crowd. As you reach the front of the crowd, the captain appears, clears his throat, and waits for the crowd to <a class=\"squiffy-link link-passage\" data-passage=\"fall silent\" role=\"link\" tabindex=\"0\">fall silent</a>.</p>",
		'passages': {
			'fall silent': {
				'text': "<p>&quot;I&#39;m sure you will all be pleased to learn that we will be stopping by the island of Arvyre.&quot; Murmers of joy rise from the crowd. &quot;For those who are new to sailing between continents, Arvyre is home to to the world-famous line of Delanno wine and Fumestone jerky. We have 3 days to dock and restock, make of that time what you will.&quot;</p>\n<p>Suddenly your head starts to ring, your temples pulse, as you <a class=\"squiffy-link link-passage\" data-passage=\"grip your head\" role=\"link\" tabindex=\"0\">grip your head</a>.</p>",
			},
			'grip your head': {
				'text': "<p>&quot;<strong>Journeyman,</strong>&quot; a familiar etheral voice pierces your mind, &quot;<strong>take heed my words. Arvyre was home to the god of merriment, yet his power dwindles with each passing day. He is being eaten alive, by what, I am not sure.</strong>&quot;</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"voice continues\" role=\"link\" tabindex=\"0\">&gt; Not now please, I&#39;m trying to act normal.</a></p>",
			},
			'voice continues': {
				'text': "<p>The voice starts to fade, &quot;<strong>Get involved if you will, but do not be tempted by anything <em>He</em> has to offer.</strong>&quot;</p>\n<p>The ringing fades, but so does <a class=\"squiffy-link link-passage\" data-passage=\"your vision\" role=\"link\" tabindex=\"0\">your vision</a>.</p>",
			},
			'your vision': {
				'text': "<p>You hear a distant scream as gravity gets the better of you.</p>\n<p><a class=\"squiffy-link link-passage\" data-passage=\"Rest\" role=\"link\" tabindex=\"0\">&gt; Maybe I should rest...</a></p>",
			},
			'Rest': {
				'text': "<p><a class=\"squiffy-link link-section\" data-section=\"Chapter 2\" role=\"link\" tabindex=\"0\">Go to Chapter 2</a></p>",
			},
		},
	},
	'Chapter 2': {
		'clear': true,
		'text': "<h2 id=\"chapter-2-the-magician\">Chapter 2 - The Magician</h2>\n<p><em>To be continued...</em></p>",
		'passages': {
		},
	},
}
})();
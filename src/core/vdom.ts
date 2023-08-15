type Fiber = {
    type: any;
    props: any;
    dom: HTMLElement | Text | null;
    parent?: Fiber;
    child?: Fiber;
    sibling?: Fiber;
    alternate?: Fiber;
    effectTag?: "UPDATE" | "PLACEMENT" | "DELETION";
    hooks?: Hook[];
};

type Hook = {
    state: any;
    queue: Function;
    cleanup?: Function;
};

const v = (() => {
    let nextUnitOfWork = null;
    let currentRoot = null;
    let deletions = [];
    let wipRoot = null;
    let wipFiber = null;
    let hookIndex = null;

    function createElement(type, props, ...children) {
        return {
            type,
            props: {
                ...props,
                children: children.map(child =>
                    typeof child === "object" ? child : createTextElement(child)
                ),
            },
        };
    }

    function createTextElement(text) {
        return {
            type: "TEXT_ELEMENT",
            props: {
                nodeValue: text,
                children: [],
            },
        };
    }

    function render(element, container) {
        wipRoot = {
            dom: container,
            props: {
                children: [element],
            },
            alternate: currentRoot,
        };
        deletions = [];
        nextUnitOfWork = wipRoot;
    }

    function createDOM(fiber) {
        const dom =
            fiber.type == "TEXT_ELEMENT"
                ? document.createTextNode("")
                : document.createElement(fiber.type);

        updateDOM(dom, {}, fiber.props);
        return dom;
    }

    const isEvent = key => key.startsWith("on");
    const isProperty = key => key !== "children" && !isEvent(key);
    function updateDOM(dom, prevProps, nextProps) {
        Object.keys(prevProps).filter(isEvent).forEach(name => {
            const eventType = name.toLowerCase().substring(2);
            dom.removeEventListener(eventType, prevProps[name]);
        });
        Object.keys(nextProps).filter(isEvent).forEach(name => {
            const eventType = name.toLowerCase().substring(2);
            dom.addEventListener(eventType, nextProps[name]);
        });
        Object.keys(prevProps).filter(isProperty).forEach(name => {
            dom[name] = "";
        });
        Object.keys(nextProps).filter(isProperty).forEach(name => {
            dom[name] = nextProps[name];
        });
    }

    function commitRoot() {
        deletions.forEach(commitWork);
        commitWork(wipRoot.child);
        currentRoot = wipRoot;
        wipRoot = null;
        flushEffects();
    }

    function commitWork(fiber) {
        if (!fiber) return;
        let domParentFiber = fiber.parent;
        while (!domParentFiber.dom) {
            domParentFiber = domParentFiber.parent;
        }
        const domParent = domParentFiber.dom;

        if (fiber.effectTag === "PLACEMENT" && fiber.dom != null) {
            domParent.appendChild(fiber.dom);
        } else if (fiber.effectTag === "UPDATE" && fiber.dom != null) {
            updateDOM(fiber.dom, fiber.alternate.props, fiber.props);
        } else if (fiber.effectTag === "DELETION") {
            domParent.removeChild(fiber.dom);
        }

        commitWork(fiber.child);
        commitWork(fiber.sibling);
    }

    function reconcileChildren(wipFiber, elements) {
        let index = 0;
        let oldFiber = wipFiber.alternate && wipFiber.alternate.child;
        let prevSibling = null;

        while (index < elements.length || oldFiber != null) {
            const element = elements[index];
            let newFiber = null;

            const sameType = oldFiber && element && element.type == oldFiber.type;
            if (sameType) {
                newFiber = {
                    type: element.type,
                    props: element.props,
                    dom: oldFiber.dom,
                    parent: wipFiber,
                    alternate: oldFiber,
                    effectTag: "UPDATE",
                };
            }
            if (element && !sameType) {
                newFiber = {
                    type: element.type,
                    props: element.props,
                    dom: null,
                    parent: wipFiber,
                    alternate: null,
                    effectTag: "PLACEMENT",
                };
            }
            if (oldFiber && !sameType) {
                oldFiber.effectTag = "DELETION";
                deletions.push(oldFiber);
            }
            if (oldFiber) {
                oldFiber = oldFiber.sibling;
            }
            if (index === 0) {
                wipFiber.child = newFiber;
            } else if (element) {
                prevSibling.sibling = newFiber;
            }
            prevSibling = newFiber;
            index++;
        }
    }

    function useState(initial) {
        // Get the old hook, if it exists.
        const oldHook =
            wipFiber.alternate &&
            wipFiber.alternate.hooks &&
            wipFiber.alternate.hooks[hookIndex];

        const hook = {
            state: oldHook ? oldHook.state : initial,
            queue: [],
        };

        // Process actions from the queue.
        const actions = oldHook ? oldHook.queue : [];
        actions.forEach(action => {
            hook.state = action(hook.state);
        });

        const setState = action => {
            if (typeof action === "function") {
                // Store functions directly in the queue.
                hook.queue.push(action);
            } else {
                // If a non-function value is passed, wrap it into a function.
                hook.queue.push(prevState => action);
            }

            // Trigger a re-render.
            wipRoot = {
                dom: currentRoot.dom,
                props: currentRoot.props,
                alternate: currentRoot,
            };
            nextUnitOfWork = wipRoot;
            deletions = [];
        };

        // Save the hook for the next render.
        wipFiber.hooks.push(hook);
        hookIndex++;

        return [hook.state, setState];
    }


    function updateFunctionComponent(fiber) {
        wipFiber = fiber;
        hookIndex = 0;
        wipFiber.hooks = [];
        const children = [fiber.type(fiber.props)];
        reconcileChildren(fiber, children);
    }

    function updateHostComponent(fiber) {
        if (!fiber.dom) {
            fiber.dom = createDOM(fiber);
        }
        reconcileChildren(fiber, fiber.props.children);
    }

    function performUnitOfWork(fiber) {
        const isFunctionComponent = fiber.type instanceof Function;
        if (isFunctionComponent) {
            updateFunctionComponent(fiber);
        } else {
            updateHostComponent(fiber);
        }

        if (fiber.child) {
            return fiber.child;
        }
        let nextFiber = fiber;
        while (nextFiber) {
            if (nextFiber.sibling) {
                return nextFiber.sibling;
            }
            nextFiber = nextFiber.parent;
        }
    }

    function workLoop(deadline) {
        let shouldYield = false;
        while (nextUnitOfWork && !shouldYield) {
            nextUnitOfWork = performUnitOfWork(nextUnitOfWork);
            shouldYield = deadline.timeRemaining() < 1;
        }

        if (!nextUnitOfWork && wipRoot) {
            commitRoot();
        }
        requestIdleCallback(workLoop);
    }

    requestIdleCallback(workLoop);

    function useEffect(callback: Function, dependencies?: any[]): void {
        const oldHook = wipFiber?.alternate && wipFiber.alternate.hooks && wipFiber.alternate.hooks[hookIndex];

        const hook: Hook = {
            state: oldHook ? oldHook.state : [],
            queue: callback
        };

        let runEffect = false;

        if (!dependencies) {
            runEffect = true; // Run on every render if no dependency array
        } else if (!oldHook) {
            runEffect = true; // If it's the first render, run the effect
        } else if (!areArraysEqual(dependencies, oldHook.state)) {
            runEffect = true; // If dependencies have changed, run the effect
        }

        if (runEffect) {
            // We will handle the actual side effects during the commit phase
            // So we push our effect callback and its cleanup function (if it exists) to a global array
            effectsQueue.push(() => {
                // Cleanup old effect if one exists
                if (oldHook && oldHook.cleanup) oldHook.cleanup();

                const cleanup = hook.queue();
                if (cleanup && typeof cleanup === 'function') {
                    hook.cleanup = cleanup; // Store the cleanup function
                }
            });
        }

        // Save the hook for the next render
        if (wipFiber) {
            wipFiber.hooks.push(hook);
            hookIndex++;
        }
    }

    // Helper function to compare two arrays for equality
    function areArraysEqual(arr1: any[], arr2: any[]): boolean {
        return arr1.length === arr2.length && arr1.every((value, index) => value === arr2[index]);
    }

    // Store our effects here
    let effectsQueue: Function[] = [];

    // At the end of our render or commit phase, run all the effects
    function flushEffects() {
        effectsQueue.forEach(effect => effect());
        effectsQueue = [];
    }


    return {
        createElement,
        render,
        useState,
        useEffect,
    };
})();

export default v;
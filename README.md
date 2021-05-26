# ppx-react-native
PPX rewriters for ReScript React Native


## Usage

Recommended to use with `ppx-install`. Add to `package.json`:

```json
{
  "ppx": ["@nasi/ppx-react-native"]
}
```

## Stylesheet

This package adds the `%%stylesheet` extension, which removes the need for `Js.t` types for stylesheet calls. It allows the use of:

```rescript
%%stylesheet(let style = {
  main: Style.create(~flex=1., ()),
  text: Style.create(~fontSize=14., ()),
})
```

This will allow you to use `style.main` and `style.text` further down in the code (or in another module) if required.

### Interaction with `%style`

This PR also allows for `%style` extension to be used within a `%%stylesheet` extension as such:
```rescript
%%stylesheet(let style = {
  main: %style({ flex: 1. }),
  text: %style({ fontSize: 14. }),
})
```
Here, you'll get `style.main` with type `Style.typed_t<[> #flex ]>>` and `style.text` with type `Style.typed_t<[> #fontSize ]>`.

This translates to:
```js
let style = ReactNative.StyleSheet.create({
  main: { flex: 1 },
  text: { fontSize: 14 },
});
```

### Translation

Consider the following:

```rescript
%%stylesheet(let style = {
  style1: Style.create(~flex=1., ()),
  style2: Style.create(~fontSize=14., ()),
})
```

This roughly translates to:
```rescript
type stylesheet = {
  style1: Style.t,
  style2: Style.t,
}

let style: stylesheet = StyleSheet.unsafeCreate({
  style1: Style.create(~flex=1., ()),
  style2: Style.create(~fontSize=14., ()),
})
```

In case a `%style` extension is present, then the tags are also added to the type definition. Consider the following:
```rescript
%%stylesheet(let style = {
  style1: Style.create(~flex=1., ()),
  style2: Style.create(~fontSize=14., ()),
  style3: %style({ flex: 1. }),
  style4: %style({ fontSize: 14. }),
})
```

This would translate to:
```rescript
type stylesheet<+'a, +'b> = {
  style1: Style.t,
  style2: Style.t,
  style3: Style.typed_t<'a>,
  style4: Style.typed_t<'b>,
}

let style: stylesheet<[> #flex ], [> #fontSize ]> = StyleSheet.unsafeCreate({
  style1: Style.create(~flex=1., ()),
  style2: Style.create(~fontSize=14., ()),
  style3: Obj.magic(Style.create(~flex=1, ())),
  style4: Obj.magic(Style.create(~fontSize=14., ())),
})
```

In both these cases, `StyleSheet.unsafeCreate` has the following definition:

```rescript
@module("react-native") @scope("StyleSheet")
external unsafeCreate: 'a => 'a = "create"
```

## Style Typing

Similar to `TyXML` and `bs-css`, we can use tagged types and variance to include/exclude specific css elements. I've defined
```rescript
// Style.resi
type typed_t<+'a>
```

Which allows labels, such as `#flex`, `#alignContent` etc. to be attached. So, a JavaScript style
```javascript
const style = {
  flex: 1,
  marginTop: 20,
  justifyContent: "center",
}
```
would be typed as:
```rescript
let style: Style.typed_t<[> #flex | #marginTop | #justifyContent ]>
```

At consumption, we can write:
```rescript
module Element = {
  @react.component
  let make: (~style:Style.typed_t<[< #flex ]>=?) => React.element
}
```
where we put all the supported style attributes in the list. In the example above, this element only accept the `flex` attribute, so if we were to write:
```rescript
<Element style /> // Compile error
```
This would raise a compile error, since `style` contains at least `#flex`, `#marginTop` and `#justifyContent`, and `Element` wants at most `#flex`.

However, if we had a style:
```rescript
let style1: Style.typed_t<[> #flex ]>
```

Then

```rescript
<Element style=style1 />
```

would be allowed.

### The `%style` extension

Normally, it would be pretty difficult to achieve this kind of covariant tagging, since the only thing that would make sense for it would be lists, and you'll end up with lots of code that breaks the zero-cost principle. So, an extension is introduced to specifically perform this translation. It also has the benefit of making the code look closer to how it's written in JavaScript. In the example above, we fine the JavaScript as
```javascript
const style = {
  flex: 1,
  marginTop: 20,
  justifyContent: "center",
}
```

Currently, we would have to write:
```rescript
let style = Style.style(~flex=1., ~marginTop=dp(20.), ~justifyContent=#center, ())
```

With the `%style` extension, we'll write:
```rescript
let style = %style({
  flex: 1.,
  marginTop: dp(20.),
  justifyContent: #center,
})
```

#### Translation
The extension roughly translates the above call to:
```rescript
let style: Style.typed_t<[> #flex | #marginTop | #justifyContent ]> = Obj.magic(
  Style.style(
    ~flex=1.,
    ~marginTop=dp(20.),
    ~justifyContent=#center,
    ()
  )
)
```

The tags are read from record fields themselves, and the field/value pair gets translated into a labelled argument to the function `style`. To give a very arbitrary example:
```rescript
let arbitrary = %style({
  field1: value1,
  field2: value2,
  field3: value3,
})
```
translates to
```rescript
let arbitrary: Style.typed_t<[> #field1 | #field2 | #field3 ]> = Obj.magic(
  Style.style(
    ~field1=value1,
    ~field2=value2,
    ~field3=value3,
    ()
  )
)
```

#### Practical Usage (tags)

I've included `TypedStyle.res` with definitions scraped from `@types/react-native` definitions, and are clustered similarly.

They include:
1. `flexStyle`
2. `transformsStyle`
3. `shadowStyleIOS`
4. `viewStyle`
5. `textStyleIOS`
6. `textStyleAndroid`
7. `textStyle`
8. `imageStyle`

I've also included utility functions to convert subsets of the above typed styles to `Style.t`. To give an example, we have:
```rescript
let flexStyle: Style.typed_t<[< flexStyle ]> => Style.t
```

We can begin to migrate component definitions to utilise the tagged styles and use these functions for conversion in the meantime.

#### Composition

I've also included 2 ways of composing typed styles. These are:

1. The `compose` function defined in `TypedStyle.res`
2. Overloading the `++` operator defined in module `Infix`.

Both methods are defined using arrays, that is:
```rescript
open TypedStyle.Infix // shadows the ++ operator (the ^ operator in OCaml)

let composed = style1 ++ style2 ++ style3
```
would produce something like:
```javascript
const composed = $caret(style1, $caret(style2, style3))
```
which is equivalent to
```javascript
const composed = [style1, [style2, style3]]
```

## Implementation

The entire project is built on `esy` and `dune`, and exists in the `ppx` directory. In order to allow development work on Windows, OCaml `4.11.x` was used with `ocaml-migrate-parsetree` to allow the code to understand `4.06.1` parsetree generated by `bs-platform`.

A postinstall script is created to copy the `ppx.exe` to the top-level of the package.

## Limitations

The `%%stylesheet` extension only works on "structure items", so:
```rescript
%%stylesheet(let style1 = { ... }) // works

module A = {
  %%stylesheet(let style2 = { ... }) // should work, not tested
}

let make = () => {
  %%stylesheet(let style3 = { ... }) // not supported
}
```

## Upcoming changes

I'm looking to include the following changes in the PPX rewriter:

1. Implicit `%style` extension within the `%%stylesheet` extension, allowing:

```rescript
%%stylesheet(let styles = {
  main: { flex: 1. },
  text: { fontSize: 14. },
})
```

2. Allow punning in the `%style` extension, allowing:
```rescript
@react.component
let make = (~fontSize) => {
  <Text style={%style({ fontSize })} />
}
```
